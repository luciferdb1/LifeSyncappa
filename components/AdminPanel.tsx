import React, { useState, useEffect } from 'react';
import { Donor } from '../types';
import { X, Loader2, Wifi, WifiOff, Users, ClipboardList, Trophy, Shield, Settings, PhoneCall, Plus, Mail, Facebook, MessageSquare } from 'lucide-react';
import { MAIN_ADMIN_EMAIL } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
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
import { motion, AnimatePresence } from 'motion/react';

import { audioService } from '../services/audioService';

interface AdminPanelProps {
  onClose: () => void;
  userRole: 'admin' | 'editor' | 'user' | null;
  initialIsAdding?: boolean;
  initialEditingDonor?: Donor | null;
  initialView?: 'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'addDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onClose, 
  userRole, 
  initialIsAdding = false, 
  initialEditingDonor = null, 
  initialView
}) => {
  const [currentView, setCurrentView] = useState<'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'addDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig'>('menu');
  const [editingDonor, setEditingDonor] = useState<Donor | null>(initialEditingDonor);
  const [sipStatus, setSipStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState(0);
  
  const isMainAdmin = auth.currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL;
  const canDelete = userRole === 'admin' || isMainAdmin;

  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView);
    } else if (initialIsAdding) {
      setCurrentView('addDonor');
    }
  }, [initialView, initialIsAdding]);

  useEffect(() => {
    // Expose function for Android app to update SIP status
    // @ts-ignore
    window.updateSipStatus = (status: string) => {
      if (['connecting', 'connected', 'disconnected'].includes(status)) {
        setSipStatus(status as any);
      }
    };

    return () => {
      // @ts-ignore
      delete window.updateSipStatus;
    };
  }, []);

  useEffect(() => {
    if (userRole !== 'admin') return;
    
    import('firebase/firestore').then(({ collection, getDocs }) => {
      const fetchFollowUps = async () => {
        try {
          const donorsRef = collection(db, 'donors');
          const snapshot = await getDocs(donorsRef);
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
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'donors');
        }
      };
      
      fetchFollowUps();
    });
  }, [userRole]);

  const menuItems = [
    { id: 'add-donor', label: 'ডোনার যোগ', icon: Plus, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-200', onClick: () => setCurrentView('addDonor'), show: true },
    { id: 'leaderboard', label: 'লিডারবোর্ড', icon: Trophy, color: 'from-red-500 to-red-600', shadow: 'shadow-red-200', onClick: () => setCurrentView('leaderboard'), show: true },
    { id: 'facebook-messaging', label: 'মেসেজ', icon: MessageSquare, color: 'from-emerald-600 to-emerald-700', shadow: 'shadow-emerald-200', onClick: () => setCurrentView('facebookMessaging'), show: userRole === 'admin' },
    { id: 'users', label: 'ইউজার', icon: Users, color: 'from-slate-700 to-slate-800', shadow: 'shadow-slate-200', onClick: () => setCurrentView('users'), show: userRole === 'admin' },
    { id: 'requests', label: 'রিকোয়েস্ট', icon: ClipboardList, color: 'from-red-600 to-red-700', shadow: 'shadow-red-200', onClick: () => setCurrentView('requests'), show: userRole === 'admin' },
    { id: 'calls', label: 'কল রেকর্ড', icon: PhoneCall, color: 'from-emerald-700 to-emerald-800', shadow: 'shadow-emerald-200', onClick: () => setCurrentView('calls'), show: userRole === 'admin' },
    { id: 'followups', label: 'ফলোআপ', icon: PhoneCall, color: 'from-red-700 to-red-800', shadow: 'shadow-red-200', onClick: () => setCurrentView('followups'), show: userRole === 'admin' },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'users':
        return <UserManagement onClose={() => setCurrentView('menu')} />;
      case 'requests':
        return <RequestManager onClose={() => setCurrentView('menu')} />;
      case 'calls':
        return <CallRecordsPanel onClose={() => setCurrentView('menu')} />;
      case 'leaderboard':
        return <Leaderboard onClose={() => setCurrentView('menu')} userRole={userRole} />;
      case 'followups':
        return <FollowUpManager onClose={() => setCurrentView('menu')} />;
      case 'facebookMessaging':
        return <FacebookMessagingPanel onClose={() => setCurrentView('menu')} />;
      case 'addDonor':
        return <AddDonorModal onClose={() => setCurrentView('menu')} onAdd={() => {}} />;
      case 'sipConfig':
        return <SIPConfigModal onClose={() => setCurrentView('menu')} />;
      case 'smtpConfig':
        return <SMTPConfigModal onClose={() => setCurrentView('menu')} />;
      case 'facebookConfig':
        return <FacebookConfigModal onClose={() => setCurrentView('menu')} />;
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Section */}
            <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 text-slate-900 dark:text-white relative overflow-hidden shrink-0 border-b border-slate-50 dark:border-slate-800">
              {/* GenZ Background Accents */}
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-500/10 rounded-full blur-[100px]" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-slate-50/50 dark:from-slate-800/20 opacity-50" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10 mb-12">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-xl relative z-10">
                      <Shield size={40} className="text-red-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white font-outfit">
                      অ্যাডমিন <span className="text-emerald-500">প্যানেল</span>
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-red-500/20">
                        Control Center
                      </span>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {/* SIP Status Indicator */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[10px] font-black border transition-all shadow-sm ${
                      sipStatus === 'connected' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      sipStatus === 'connecting' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                      'bg-red-50 border-red-100 text-red-600'
                    }`}
                  >
                    {sipStatus === 'connected' ? <Wifi size={16} /> : 
                     sipStatus === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : 
                     <WifiOff size={16} />}
                    <span className="hidden sm:inline tracking-widest uppercase">
                      {sipStatus === 'connected' ? 'SIP ONLINE' : 
                       sipStatus === 'connecting' ? 'CONNECTING...' : 
                       'SIP OFFLINE'}
                    </span>
                  </motion.div>

                  {isMainAdmin && (
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentView('sipConfig')} 
                      className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                      title="SIP সেটিংস"
                    >
                      <Settings size={20} />
                    </motion.button>
                  )}

                  {isMainAdmin && (
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentView('smtpConfig')} 
                      className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                      title="SMTP সেটিংস"
                    >
                      <Mail size={20} />
                    </motion.button>
                  )}

                  {isMainAdmin && (
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentView('facebookConfig')} 
                      className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                      title="ফেসবুক সেটিংস"
                    >
                      <Facebook size={20} />
                    </motion.button>
                  )}
                  
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose} 
                    className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 soft-shadow"
                  >
                    <X size={20} />
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-slate-50/50 dark:bg-slate-900/50 pb-24 sm:pb-32">
              {/* Admin Menu Tabs - GenZ Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
                {menuItems.filter(item => item.show).map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ 
                      y: -5, 
                      scale: 1.02,
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={item.onClick}
                    className={`group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm hover:shadow-xl transition-all border border-slate-100 dark:border-slate-700 overflow-hidden`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                    
                    {item.id === 'followups' && pendingFollowUpsCount > 0 && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white font-black text-[10px] w-6 h-6 rounded-xl flex items-center justify-center shadow-lg shadow-red-200 animate-bounce">
                        {pendingFollowUpsCount}
                      </div>
                    )}

                    <div className={`p-4 rounded-2xl mb-4 bg-gradient-to-br ${item.color} text-white shadow-md ${item.shadow} group-hover:scale-110 transition-transform duration-500`}>
                      <item.icon size={24} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-center leading-tight text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 flex flex-col z-50 overflow-hidden">
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

      {/* Edit Donor Modal Overlay */}
      <AnimatePresence>
        {editingDonor && (
          <EditDonorModal 
            donor={editingDonor}
            onClose={() => setEditingDonor(null)}
            onUpdate={() => {}}
            onDelete={() => {}}
            isAdmin={canDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
