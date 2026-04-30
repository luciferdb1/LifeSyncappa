import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { UserProfile, ActivityLog } from '../types';
import { getAuth } from 'firebase/auth';
import { X, User, Phone, Award, History, Clock, FilePlus, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRoleBadgeDefinition } from '../lib/roleUtils';

interface UserProfileModalProps {
  user: UserProfile;
  onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (showHistory && user.uid) {
      setLoadingHistory(true);
      const logsQuery = query(
        collection(db, 'logs'),
        where('userUid', '==', user.uid)
        // orderBy('timestamp', 'desc') // Might require an index
      );

      const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
        try {
          const logs: ActivityLog[] = [];
          snapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() } as ActivityLog);
          });
          // Sort client-side to avoid index requirement
          logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivityLogs(logs);
        } catch (error) {
          console.error("Error fetching logs:", error);
        } finally {
          setLoadingHistory(false);
        }
      }, (error) => {
        console.error("Error subscribing to logs:", error);
        setLoadingHistory(false);
      });

      return () => unsubscribe();
    }
  }, [showHistory, user.uid]);

  const handleCall = () => {
    // @ts-ignore
    if (window.Android && window.Android.makeSipCall) {
      const callerUid = getAuth().currentUser?.uid || 'unknown';
      const callerName = getAuth().currentUser?.displayName || 'Unknown User';
      // @ts-ignore
      window.Android.makeSipCall(user.phone, user.displayName || 'Unknown', callerUid, callerName);
    } else {
      window.location.href = `tel:${user.phone}`;
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'call': return <Phone size={14} className="text-emerald-500" />;
      case 'create': return <FilePlus size={14} className="text-blue-500" />;
      case 'update': return <Edit size={14} className="text-amber-500" />;
      case 'delete': return <Trash2 size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-slate-500" />;
    }
  };

  const getActivityText = (log: ActivityLog) => {
    switch (log.action) {
      case 'call': return `Called ${log.donorName || 'donor'}`;
      case 'create': return `Added donor: ${log.donorName || 'Unknown'}`;
      case 'update': return log.details || `Updated donor: ${log.donorName || 'Unknown'}`;
      case 'delete': return `Deleted donor: ${log.donorName || 'Unknown'}`;
      default: return log.details || 'Unknown action';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative w-full ${showHistory ? 'max-w-2xl' : 'max-w-sm'} bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-6 items-center md:items-start overflow-hidden overflow-y-auto max-h-[90vh]`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full hover:bg-red-50 hover:text-red-500 transition-all z-10"
        >
          <X size={16} />
        </button>

        {/* Profile Info Section */}
        <div className="flex flex-col items-center w-full md:w-64 shrink-0">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden mb-4 mt-2">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20"></div>
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover relative z-10" />
            ) : (
              <User size={36} className="text-emerald-600 dark:text-emerald-400 relative z-10" />
            )}
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1 text-center">{user.displayName || 'Unknown User'}</h2>
          
          <div className="flex flex-wrap justify-center gap-2 items-center mb-6">
            {(() => {
              if (user.role === 'user' || user.role === 'blood_donor' || !user.role || user.role === '') return null;
              const roleBadge = getRoleBadgeDefinition(user.role);
              return (
                <span className={`flex items-center gap-1.5 px-3 py-1 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[10px] font-black uppercase tracking-widest rounded-lg`}>
                  <roleBadge.icon size={12} />
                  {roleBadge.label}
                </span>
              );
            })()}
            <span className="flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100 dark:border-amber-900/30">
              <Award size={12} />
              {user.points || 0} PTS
            </span>
          </div>

          {user.phone && (
            <div className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4 border border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Phone size={14} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{user.phone}</p>
              </div>
            </div>
          )}

          <div className="w-full space-y-2">
            {user.phone ? (
              <button 
                onClick={handleCall}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex justify-center items-center gap-2 font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all focus:ring-4 focus:ring-emerald-500/30"
              >
                <Phone size={16} className="animate-pulse" />
                কল করুন
              </button>
            ) : (
              <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl flex justify-center items-center gap-2 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700">
                <Phone size={16} />
                নো ফোন নাম্বার
              </div>
            )}
            
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`w-full py-3 rounded-xl flex justify-center items-center gap-2 font-black uppercase tracking-widest text-xs transition-all border ${
                showHistory 
                  ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <History size={16} />
              {showHistory ? 'Hide History' : 'View History'}
            </button>
          </div>
        </div>

        {/* History Section */}
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ opacity: 0, width: 0, paddingLeft: 0 }}
              animate={{ opacity: 1, width: '100%', paddingLeft: 16 }}
              exit={{ opacity: 0, width: 0, paddingLeft: 0 }}
              className="flex-1 overflow-hidden flex flex-col h-full border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-6 md:pt-0 mt-6 md:mt-0"
            >
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2 shrink-0">
                <History size={16} className="text-emerald-500" />
                Activity History
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {loadingHistory ? (
                  <div className="flex justify-center p-6 text-slate-400">
                    <span className="animate-spin w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <History size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No recent activity</p>
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex gap-3 shadow-sm hover:border-emerald-500/30 transition-colors">
                      <div className="mt-1">
                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                          {getActivityIcon(log.action)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide truncate">
                          {getActivityText(log)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          <Clock size={10} />
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default UserProfileModal;
