import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Donor } from '../types';
import { PhoneCall, CheckCircle, XCircle, Clock, Search, Loader2 } from 'lucide-react';

interface FollowUpManagerProps {
  onClose: () => void;
}

const FollowUpManager: React.FC<FollowUpManagerProps> = ({ onClose }) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonor, setSelectedDonor] = useState<{ donor: Donor, type: '3day' | '7day' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      // Fetch all donors who have pending or failed follow-ups
      // To optimize, we could query for lastDonationDate >= 10 days ago, but Firestore doesn't support
      // complex date math easily without storing timestamps.
      // We'll fetch all donors and filter on the client. For a large database, this might be slow,
      // but assuming a reasonable number of donors, it's okay for now.
      // A better approach is to query where followUp3DayStatus != 'completed' OR followUp7DayStatus != 'completed'
      // Firestore doesn't support OR queries easily across different fields without composite indexes.
      // Let's just fetch all donors and filter.
      const donorsRef = collection(db, 'donors');
      const snapshot = await getDocs(donorsRef);
      const allDonors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Donor));
      
      const now = new Date();
      
      const pendingFollowUps = allDonors.filter(donor => {
        if (!donor.lastDonationDate) return false;
        
        const donationDate = new Date(donor.lastDonationDate);
        const diffTime = now.getTime() - donationDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // 3-Day Follow-up Logic
        if (diffDays >= 3 && donor.followUp3DayStatus !== 'completed') {
          if (donor.followUp3DayStatus === 'failed' && donor.followUp3DayNextReminder) {
            const nextReminder = new Date(donor.followUp3DayNextReminder);
            if (now >= nextReminder) return true;
          } else {
            return true;
          }
        }
        
        // 7-Day Follow-up Logic
        if (diffDays >= 7 && donor.followUp7DayStatus !== 'completed') {
          if (donor.followUp7DayStatus === 'failed' && donor.followUp7DayNextReminder) {
            const nextReminder = new Date(donor.followUp7DayNextReminder);
            if (now >= nextReminder) return true;
          } else {
            return true;
          }
        }
        
        return false;
      });
      
      setDonors(pendingFollowUps);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'donors');
    } finally {
      setLoading(false);
    }
  };

  const handleCallResult = async (success: boolean) => {
    if (!selectedDonor) return;
    
    setActionLoading(true);
    try {
      const donorRef = doc(db, 'donors', selectedDonor.donor.id);
      const updates: any = {};
      
      if (selectedDonor.type === '3day') {
        if (success) {
          updates.followUp3DayStatus = 'completed';
          updates.followUp3DayNextReminder = '';
        } else {
          updates.followUp3DayStatus = 'failed';
          const nextReminder = new Date();
          nextReminder.setHours(nextReminder.getHours() + 1); // Remind after 1 hour
          updates.followUp3DayNextReminder = nextReminder.toISOString();
        }
      } else {
        if (success) {
          updates.followUp7DayStatus = 'completed';
          updates.followUp7DayNextReminder = '';
        } else {
          updates.followUp7DayStatus = 'failed';
          const nextReminder = new Date();
          nextReminder.setHours(nextReminder.getHours() + 1); // Remind after 1 hour
          updates.followUp7DayNextReminder = nextReminder.toISOString();
        }
      }
      
      await updateDoc(donorRef, updates);
      setSelectedDonor(null);
      fetchFollowUps(); // Refresh list
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${selectedDonor.donor.id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getFollowUpType = (donor: Donor): '3day' | '7day' | null => {
    if (!donor.lastDonationDate) return null;
    const now = new Date();
    const donationDate = new Date(donor.lastDonationDate);
    const diffTime = now.getTime() - donationDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 3 && donor.followUp3DayStatus !== 'completed') {
      if (donor.followUp3DayStatus === 'failed' && donor.followUp3DayNextReminder) {
        if (now >= new Date(donor.followUp3DayNextReminder)) return '3day';
      } else {
        return '3day';
      }
    }

    if (diffDays >= 7 && donor.followUp7DayStatus !== 'completed') {
      if (donor.followUp7DayStatus === 'failed' && donor.followUp7DayNextReminder) {
        if (now >= new Date(donor.followUp7DayNextReminder)) return '7day';
      } else {
        return '7day';
      }
    }
    
    return null;
  };

  const handleCallClick = (donor: Donor, type: '3day' | '7day') => {
    // Initiate SIP call
    // @ts-ignore
    if (window.Android && window.Android.makeSipCall) {
      import('../firebase').then(({ auth }) => {
        const callerUid = auth.currentUser?.uid || 'unknown';
        const callerName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Admin';
        // @ts-ignore
        window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
      });
    } else {
      // @ts-ignore
      if (window.showAppAlert) {
        // @ts-ignore
        window.showAppAlert("SIP কলিং শুধুমাত্র অ্যান্ড্রয়েড অ্যাপ থেকে সমর্থিত। অনুগ্রহ করে অ্যাপ ব্যবহার করুন।");
      }
    }
    
    // Show confirmation modal
    setSelectedDonor({ donor, type });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="bg-rose-600 dark:bg-slate-950 p-6 text-white shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 dark:bg-slate-800 p-3 rounded-2xl">
            <PhoneCall size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black">ফলোআপ কল</h2>
            <p className="text-rose-100 dark:text-slate-400 text-sm mt-1">রক্তদানের ৩ দিন এবং ৭ দিন পর ডোনারের খোঁজ নিন</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 size={40} className="text-rose-500 animate-spin" />
          </div>
        ) : donors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
            <CheckCircle size={64} className="mb-4 text-emerald-400 opacity-50" />
            <p className="text-lg font-bold">কোনো ফলোআপ কল বাকি নেই</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
                <tr className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">ফলোআপের ধরন</th>
                  <th className="p-4">ডোনারের তথ্য</th>
                  <th className="p-4 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {donors.map((donor, index) => {
                  const type = getFollowUpType(donor);
                  if (!type) return null;
                  
                  return (
                    <tr key={donor.id} className={`hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-900/50'}`}>
                      <td className="p-4 align-middle">
                        <div className="flex flex-col gap-2">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit ${type === '3day' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                            {type === '3day' ? '৩ দিনের ফলোআপ' : '৭ দিনের ফলোআপ'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1">
                            <Clock size={10} /> রক্তদান: {donor.lastDonationDate}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{donor.name}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                          <PhoneCall size={10} /> {donor.phone}
                        </p>
                      </td>
                      <td className="p-4 align-middle text-center">
                        <button
                          onClick={() => handleCallClick(donor, type)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center justify-center gap-2"
                        >
                          <PhoneCall size={14} />
                          কল করুন
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedDonor && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-rose-50 dark:bg-rose-900/10 p-6 text-center border-b border-rose-100 dark:border-rose-900/20">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneCall size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">কল কনফার্মেশন</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                আপনি কি <strong>{selectedDonor.donor.name}</strong> ({selectedDonor.donor.phone}) এর সাথে যোগাযোগ করতে পেরেছেন?
              </p>
            </div>
            
            <div className="p-6 space-y-3 bg-white dark:bg-slate-900">
              <button
                onClick={() => handleCallResult(true)}
                disabled={actionLoading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                হ্যাঁ, কথা হয়েছে
              </button>
              
              <button
                onClick={() => handleCallResult(false)}
                disabled={actionLoading}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-md shadow-amber-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <Clock size={20} />}
                না, ১ ঘণ্টা পর আবার রিমাইন্ডার দিন
              </button>
              
              <button
                onClick={() => setSelectedDonor(null)}
                disabled={actionLoading}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-4"
              >
                <XCircle size={20} />
                বাতিল করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpManager;
