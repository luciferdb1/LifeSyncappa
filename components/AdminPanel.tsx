import React, { useState, useEffect } from 'react';
import { Donor } from '../types';
import { X, Loader2, Wifi, WifiOff, Users, ClipboardList, Trophy, Shield, Settings, PhoneCall, Plus, Mail, Facebook, MessageSquare } from 'lucide-react';
import { MAIN_ADMIN_EMAIL } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { updateDoc, deleteDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import EditDonorModal from './EditDonorModal';
import AddDonorModal from './AddDonorModal';
import SIPConfigModal from './SIPConfigModal';
import SMTPConfigModal from './SMTPConfigModal';
import FacebookConfigModal from './FacebookConfigModal';
import FacebookMessagingPanel from './FacebookMessagingPanel';
import UserManagement from './UserManagement';
import RequestManager from './RequestManager';
import CallRecordsPanel from './CallRecordsPanel';
import Leaderboard from './Leaderboard';
import FollowUpManager from './FollowUpManager';
import PosterApprovalsPanel from './PosterApprovalsPanel';
import { motion, AnimatePresence } from 'motion/react';

import { audioService } from '../services/audioService';

interface AdminPanelProps {
  onClose: () => void;
  userRole: 'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user' | null;
  initialIsAdding?: boolean;
  initialEditingDonor?: Donor | null;
  initialView?: 'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'posters' | 'addDonor' | 'editDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig' | 'settingsMenu';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onClose, 
  userRole, 
  initialIsAdding = false, 
  initialEditingDonor = null, 
  initialView
}) => {
  const [currentView, setCurrentView] = useState<'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'posters' | 'addDonor' | 'editDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig' | 'settingsMenu'>('menu');
  const [editingDonor, setEditingDonor] = useState<Donor | null>(initialEditingDonor);
  const [sipStatus, setSipStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState(0);
  
  const isMainAdmin = auth.currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL;
  const canDelete = userRole === 'admin' || userRole === 'president' || isMainAdmin;

  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView);
    } else if (initialIsAdding) {
      setCurrentView('addDonor');
    } else if (initialEditingDonor) {
      setCurrentView('editDonor');
    }
  }, [initialView, initialIsAdding, initialEditingDonor]);

  useEffect(() => {
    // Activity Logs and Requests Auto-Cleanup
    const cleanupOldRecords = async () => {
      try {
        if (isMainAdmin) { // Only run for main admin to avoid multiple runs
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          
          const oldLogsQuery = query(
            collection(db, 'logs'), 
            where('timestamp', '<', threeMonthsAgo.toISOString())
          );
          
          const logsSnapshot = await getDocs(oldLogsQuery);
          let logsCount = 0;
          logsSnapshot.forEach(async (docSnapshot) => {
            await deleteDoc(docSnapshot.ref);
            logsCount++;
          });
          if(logsCount > 0) console.log(`Cleaned up ${logsCount} old activity logs.`);

          // Cleanup requests older than 1 month
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          
          const oldRequestsQuery = query(
            collection(db, 'requests'),
            where('createdAt', '<', oneMonthAgo.toISOString())
          );
          
          const reqSnapshot = await getDocs(oldRequestsQuery);
          let reqCount = 0;
          reqSnapshot.forEach(async (docSnapshot) => {
            await deleteDoc(docSnapshot.ref);
            reqCount++;
          });
          if(reqCount > 0) console.log(`Cleaned up ${reqCount} old requests.`);
        }
      } catch (error) {
        console.error("Error cleaning up old records:", error);
      }
    };
    
    cleanupOldRecords();
  }, [isMainAdmin]);

  useEffect(() => {
    if (userRole !== 'admin') return;
    
    let unsubscribe: (() => void) | undefined;
    
    import('firebase/firestore').then(({ collection, onSnapshot }) => {
      const donorsRef = collection(db, 'donors');
      unsubscribe = onSnapshot(donorsRef, (snapshot) => {
        try {
          const allDonors = snapshot.docs.map(doc => doc.data() as Donor);
          
          const now = new Date();
          let count = 0;
          
          allDonors.forEach(donor => {
            if (!donor.lastDonationDate) return;
            
            const donationDate = new Date(donor.lastDonationDate);
            const diffTime = now.getTime() - donationDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let needsFollowUp = false;
            
            if (diffDays >= 3 && donor.followUp3DayStatus !== 'completed') {
              if (donor.followUp3DayStatus === 'failed' && donor.followUp3DayNextReminder) {
                if (now >= new Date(donor.followUp3DayNextReminder)) needsFollowUp = true;
              } else {
                needsFollowUp = true;
              }
            }
            
            if (diffDays >= 7 && donor.followUp7DayStatus !== 'completed') {
              if (donor.followUp7DayStatus === 'failed' && donor.followUp7DayNextReminder) {
                if (now >= new Date(donor.followUp7DayNextReminder)) needsFollowUp = true;
              } else {
                needsFollowUp = true;
              }
            }
            
            if (needsFollowUp) count++;
          });
          
          setPendingFollowUpsCount(count);
        } catch (error: any) {
          if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
            handleFirestoreError(error, OperationType.LIST, 'donors');
          }
        }
      }, (error: any) => {
        if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.LIST, 'donors');
        } else {
          console.error("Firestore permission denied for admin panel donors list:", error.message);
        }
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userRole]);

  const menuItems = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, color: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-200', onClick: () => setCurrentView('leaderboard'), show: userRole !== 'media' },
    { id: 'posters', label: 'Poster Approvals', icon: MessageSquare, color: 'from-indigo-600 to-indigo-700', shadow: 'shadow-indigo-200', onClick: () => setCurrentView('posters'), show: userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' || userRole === 'editor' },
    { id: 'facebook-messaging', label: 'Message Box', icon: Facebook, color: 'from-blue-600 to-blue-700', shadow: 'shadow-blue-200', onClick: () => setCurrentView('facebookMessaging'), show: userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' },
    { id: 'users', label: 'User Management', icon: Users, color: 'from-slate-700 to-slate-800', shadow: 'shadow-slate-200', onClick: () => setCurrentView('users'), show: userRole === 'admin' || userRole === 'president' },
    { id: 'requests', label: 'Request List', icon: ClipboardList, color: 'from-rose-600 to-rose-700', shadow: 'shadow-rose-200', onClick: () => setCurrentView('requests'), show: userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' },
    { id: 'calls', label: 'Call Records', icon: PhoneCall, color: 'from-teal-700 to-teal-800', shadow: 'shadow-teal-200', onClick: () => setCurrentView('calls'), show: userRole !== 'volunteer' },
    { id: 'followups', label: 'Follow-up Calls', icon: PhoneCall, color: 'from-red-700 to-red-800', shadow: 'shadow-red-200', onClick: () => setCurrentView('followups'), show: userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'from-slate-600 to-slate-700', shadow: 'shadow-slate-200', onClick: () => setCurrentView('settingsMenu'), show: isMainAdmin },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'editDonor':
        return editingDonor ? (
          <EditDonorModal 
            donor={editingDonor}
            onClose={() => setCurrentView('menu')}
            onUpdate={() => setCurrentView('menu')}
            onDelete={() => setCurrentView('menu')}
            isAdmin={canDelete}
          />
        ) : <div className="p-8 text-center">No donor selected for editing.</div>;
      case 'users':
        return <UserManagement onClose={() => setCurrentView('menu')} />;
      case 'requests':
        return <RequestManager onClose={() => setCurrentView('menu')} onEditDonor={(d) => { setEditingDonor(d); setCurrentView('editDonor'); }} />;
      case 'calls':
        return <CallRecordsPanel onClose={() => setCurrentView('menu')} />;
      case 'leaderboard':
        return <Leaderboard onClose={() => setCurrentView('menu')} userRole={userRole} />;
      case 'followups':
        return <FollowUpManager onClose={() => setCurrentView('menu')} />;
      case 'facebookMessaging':
        return <FacebookMessagingPanel onClose={() => setCurrentView('menu')} />;
      case 'posters':
        return <PosterApprovalsPanel onClose={() => setCurrentView('menu')} />;
      case 'sipConfig':
        return <SIPConfigModal onClose={() => setCurrentView('settingsMenu')} />;
      case 'smtpConfig':
        return <SMTPConfigModal onClose={() => setCurrentView('settingsMenu')} />;
      case 'facebookConfig':
        return <FacebookConfigModal onClose={() => setCurrentView('settingsMenu')} />;
      case 'settingsMenu':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 text-slate-900 dark:text-white relative overflow-hidden shrink-0 border-b border-slate-50 dark:border-slate-800">
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <Settings size={24} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white font-outfit">
                      Admin <span className="text-emerald-500">Settings</span>
                    </h2>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentView('menu')} 
                  className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all border border-slate-100 dark:border-slate-700 soft-shadow"
                >
                  <X size={16} />
                </motion.button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentView('sipConfig')}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700"
                >
                  <div className="p-3 rounded-xl mb-3 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-200">
                    <PhoneCall size={24} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">SIP Configuration</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentView('smtpConfig')}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700"
                >
                  <div className="p-3 rounded-xl mb-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200">
                    <Mail size={24} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">SMTP Configuration</span>
                </motion.button>

                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentView('facebookConfig')}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700"
                >
                  <div className="p-3 rounded-xl mb-3 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200">
                    <Facebook size={24} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Facebook Configuration</span>
                </motion.button>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Shield size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white font-outfit">
                      {userRole === 'media' ? 'Media ' : 'Admin '}
                      <span className="text-emerald-500">Panel</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-red-500/20">
                        Control Center
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* SIP Status Indicator */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black border transition-all shadow-sm ${
                      sipStatus === 'connected' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      sipStatus === 'connecting' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                      'bg-red-50 border-red-100 text-red-600'
                    }`}
                  >
                    {sipStatus === 'connected' ? <Wifi size={14} /> : 
                     sipStatus === 'connecting' ? <Loader2 size={14} className="animate-spin" /> : 
                     <WifiOff size={14} />}
                    <span className="hidden sm:inline tracking-widest uppercase">
                      {sipStatus === 'connected' ? 'SIP Online' : 
                       sipStatus === 'connecting' ? 'Connecting...' : 
                       'SIP Offline'}
                    </span>
                  </motion.div>
                  
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose} 
                    className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all border border-slate-100 dark:border-slate-700 soft-shadow"
                  >
                    <X size={18} />
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50 pb-20">
              <div className="max-w-7xl mx-auto">
                {/* Admin Menu Tabs - Modern Bento Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10">
                  {menuItems.filter(item => item.show).map((item) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ 
                        y: -4, 
                        scale: 1.02,
                      }}
                      whileTap={{ scale: 0.95 }}
                      onClick={item.onClick}
                      className={`group relative flex flex-col items-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-800 overflow-hidden text-center h-full`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                      
                      {item.id === 'followups' && pendingFollowUpsCount > 0 && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white font-black text-[9px] w-5 h-5 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/40 animate-bounce z-20">
                          {pendingFollowUpsCount}
                        </div>
                      )}

                      <div className={`p-3 rounded-xl mb-4 bg-gradient-to-br ${item.color} text-white shadow-md ${item.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                        <item.icon size={20} />
                      </div>
                      
                      <div className="mt-auto">
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors block mb-0.5">
                          Manage
                        </span>
                        <span className="text-sm font-black tracking-tight leading-tight text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform block">
                          {item.label}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full h-full flex flex-col overflow-hidden"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
