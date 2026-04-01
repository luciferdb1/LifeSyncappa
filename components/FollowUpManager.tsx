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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 dark:bg-slate-800 p-3 rounded-2xl">
              <PhoneCall size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black">ফলোআপ কল</h2>
              <p className="text-rose-100 dark:text-slate-400 text-sm mt-1">রক্তদানের ৩ দিন এবং ৭ দিন পর ডোনারের খোঁজ নিন</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <XCircle size={28} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-40">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <Loader2 size={48} className="text-rose-500 animate-spin" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">লোড হচ্ছে...</p>
          </div>
        ) : donors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-full mb-6">
              <CheckCircle size={64} className="text-emerald-500" />
            </div>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">সব ফলোআপ সম্পন্ন!</p>
            <p className="text-sm font-bold mt-2">বর্তমানে কোনো ফলোআপ কল বাকি নেই</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-100 dark:border-slate-700">
                    <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="p-6">ফলোআপের ধরন</th>
                      <th className="p-6">ডোনারের তথ্য</th>
                      <th className="p-6 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {donors.map((donor, index) => {
                      const type = getFollowUpType(donor);
                      if (!type) return null;
                      
                      return (
                        <tr key={donor.id} className={`hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all group ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/20'}`}>
                          <td className="p-6 align-middle">
                            <div className="flex flex-col gap-2">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit shadow-sm ${type === '3day' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                                {type === '3day' ? '৩ দিনের ফলোআপ' : '৭ দিনের ফলোআপ'}
                              </span>
                              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                                <Clock size={12} /> রক্তদান: {donor.lastDonationDate}
                              </div>
                            </div>
                          </td>
                          <td className="p-6 align-middle">
                            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1 group-hover:text-rose-600 transition-colors">{donor.name}</h3>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-black tracking-widest flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg w-fit">
                              <PhoneCall size={12} className="text-rose-500" /> {donor.phone}
                            </div>
                          </td>
                          <td className="p-6 align-middle text-center">
                            <button
                              onClick={() => handleCallClick(donor, type)}
                              className="px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-rose-200 dark:shadow-none transition-all transform hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-3 whitespace-nowrap"
                            >
                              <PhoneCall size={18} />
                              কল করুন
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-6">
              {donors.map((donor) => {
                const type = getFollowUpType(donor);
                if (!type) return null;
                
                return (
                  <div key={donor.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-100 dark:border-slate-800 space-y-6 transform transition-all active:scale-[0.98]">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-3">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit shadow-sm ${type === '3day' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                          {type === '3day' ? '৩ দিনের ফলোআপ' : '৭ দিনের ফলোআপ'}
                        </span>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{donor.name}</h3>
                      </div>
                      <div className="text-right bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">রক্তদান</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{donor.lastDonationDate}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-slate-900 dark:text-white text-base font-black bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl">
                        <PhoneCall size={20} className="text-rose-600 dark:text-rose-400" />
                      </div>
                      {donor.phone}
                    </div>
                    
                    <button
                      onClick={() => handleCallClick(donor, type)}
                      className="w-full py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-[1.5rem] text-base font-black uppercase tracking-[0.2em] shadow-2xl shadow-rose-200 dark:shadow-none transition-all transform active:scale-95 flex items-center justify-center gap-4"
                    >
                      <PhoneCall size={24} />
                      কল করুন
                    </button>
                  </div>
                );
              })}
            </div>
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
