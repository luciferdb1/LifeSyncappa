import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Donor } from '../types';
import { PhoneCall, CheckCircle, XCircle, Clock, Search, Loader2, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FollowUpManagerProps {
  onClose: () => void;
}

const FollowUpManager: React.FC<FollowUpManagerProps> = ({ onClose }) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonor, setSelectedDonor] = useState<{ donor: Donor, type: '3day' | '7day' } | null>(null);
  const [noNeedDonor, setNoNeedDonor] = useState<{ donor: Donor, type: '3day' | '7day' } | null>(null);
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
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, 'donors');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNoNeed = async () => {
    if (!noNeedDonor) return;
    const { donor, type } = noNeedDonor;
    
    setActionLoading(true);
    try {
      const donorRef = doc(db, 'donors', donor.id);
      const updates: any = {};
      
      // Mark both as completed if "No Need" is clicked, 
      // as the user likely doesn't want any more follow-ups for this donation cycle.
      updates.followUp3DayStatus = 'completed';
      updates.followUp3DayNextReminder = '';
      updates.followUp7DayStatus = 'completed';
      updates.followUp7DayNextReminder = '';
      
      await updateDoc(donorRef, updates);
      
      // Immediately remove from local state for instant feedback
      setDonors(prev => prev.filter(d => d.id !== donor.id));
      setNoNeedDonor(null);
      
      // Refresh to be sure
      setTimeout(() => fetchFollowUps(), 500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donor.id}`);
    } finally {
      setActionLoading(false);
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
        const callerName = auth.currentUser?.displayName || 'Unknown User';
        // @ts-ignore
        window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
      });
    } else {
      // @ts-ignore
      if (window.showAppAlert) {
        // @ts-ignore
        window.showAppAlert("SIP calling is only supported from the Android app. Please use the app.");
      }
    }
    
    // Show confirmation modal
    setSelectedDonor({ donor, type });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="bg-rose-600 dark:bg-slate-950 p-3 text-white shrink-0 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 dark:bg-slate-800 p-1.5 rounded-xl">
              <PhoneCall size={16} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Follow-up Calls</h2>
              <p className="text-rose-100 dark:text-slate-400 text-[10px] mt-0.5">Check on donors 3 days and 7 days after donation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 pb-20">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-48 space-y-3">
            <Loader2 size={32} className="text-rose-500 animate-spin" />
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Loading...</p>
          </div>
        ) : donors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-full mb-4">
              <CheckCircle size={48} className="text-emerald-500" />
            </div>
            <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">All follow-ups completed!</p>
            <p className="text-xs font-medium mt-1">No follow-up calls pending currently</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <tr className="text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                      <th className="p-2">Follow-up Type</th>
                      <th className="p-2">Donor Info</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <AnimatePresence mode="popLayout">
                      {donors.map((donor, index) => {
                        const type = getFollowUpType(donor);
                        if (!type) return null;
                        
                        return (
                          <motion.tr 
                            key={donor.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all group ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/20'}`}
                          >
                            <td className="p-2 align-middle">
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider w-fit shadow-sm ${type === '3day' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                                  {type === '3day' ? '3-Day Follow-up' : '7-Day Follow-up'}
                                </span>
                                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[8px] font-bold uppercase tracking-wider mt-0.5">
                                  <Clock size={8} /> Donation: {donor.lastDonationDate}
                                </div>
                              </div>
                            </td>
                            <td className="p-2 align-middle">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 group-hover:text-rose-600 transition-colors">{donor.name}</h3>
                              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wider flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">
                                <PhoneCall size={8} className="text-rose-500" /> {donor.phone}
                              </div>
                            </td>
                            <td className="p-2 align-middle text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleCallClick(donor, type)}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm shadow-rose-200 dark:shadow-none transition-all transform hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                                >
                                  <PhoneCall size={12} />
                                  Call Now
                                </button>
                                <button
                                  onClick={() => setNoNeedDonor({ donor, type })}
                                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap border border-slate-200 dark:border-slate-700"
                                  title="No Need to Call"
                                >
                                  <Ban size={12} />
                                  No Need
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              <AnimatePresence mode="popLayout">
                {donors.map((donor) => {
                  const type = getFollowUpType(donor);
                  if (!type) return null;
                  
                  return (
                    <motion.div 
                      key={donor.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transform transition-all active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider w-fit shadow-sm ${type === '3day' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                            {type === '3day' ? '3-Day Follow-up' : '7-Day Follow-up'}
                          </span>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{donor.name}</h3>
                        </div>
                        <div className="text-right bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg">
                          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Donation</span>
                          <span className="text-[9px] font-bold text-slate-900 dark:text-white">{donor.lastDonationDate}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-slate-900 dark:text-white text-xs font-bold bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="bg-rose-100 dark:bg-rose-900/30 p-1 rounded-lg">
                          <PhoneCall size={12} className="text-rose-600 dark:text-rose-400" />
                        </div>
                        {donor.phone}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCallClick(donor, type)}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm shadow-rose-200 dark:shadow-none transition-all transform active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <PhoneCall size={14} />
                          Call Now
                        </button>
                        <button
                          onClick={() => setNoNeedDonor({ donor, type })}
                          className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
                        >
                          <Ban size={14} />
                          No Need
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* No Need Confirmation Modal */}
      {noNeedDonor && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 text-center border-b border-amber-100 dark:border-amber-900/20">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <Ban size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Cancel Follow-up</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs leading-relaxed">
                Do you want to cancel the <strong>{noNeedDonor.type === '3day' ? '3-day' : '7-day'}</strong> follow-up for <strong>{noNeedDonor.donor.name}</strong>?
              </p>
            </div>
            
            <div className="p-4 flex gap-2 bg-white dark:bg-slate-900">
              <button
                onClick={() => setNoNeedDonor(null)}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-xs"
              >
                No, Keep it
              </button>
              <button
                onClick={handleNoNeed}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedDonor && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 text-center border-b border-rose-100 dark:border-rose-900/20">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <PhoneCall size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Call Confirmation</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs">
                Were you able to contact <strong>{selectedDonor.donor.name}</strong> ({selectedDonor.donor.phone})?
              </p>
            </div>
            
            <div className="p-4 space-y-2 bg-white dark:bg-slate-900">
              <button
                onClick={() => handleCallResult(true)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Yes, talked
              </button>
              
              <button
                onClick={() => handleCallResult(false)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm shadow-amber-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                No, remind me after 1 hour
              </button>
              
              <button
                onClick={() => setSelectedDonor(null)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-2 text-xs"
              >
                <XCircle size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpManager;
