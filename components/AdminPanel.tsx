import React, { useState, useEffect } from 'react';
import { Donor } from '../types';
import { X, Loader2, Wifi, WifiOff, Users, ClipboardList, Trophy, Shield, Settings, PhoneCall, Plus, Mail, Facebook } from 'lucide-react';
import { MAIN_ADMIN_EMAIL } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import EditDonorModal from './EditDonorModal';
import AddDonorModal from './AddDonorModal';
import SIPConfigModal from './SIPConfigModal';
import SMTPConfigModal from './SMTPConfigModal';
import FacebookRequestsPanel from './FacebookRequestsPanel';
import { motion, AnimatePresence } from 'motion/react';

import { audioService } from '../services/audioService';

interface AdminPanelProps {
  onClose: () => void;
  userRole: 'admin' | 'editor' | 'user' | null;
  initialIsAdding?: boolean;
  initialEditingDonor?: Donor | null;
  onShowUserManagement?: () => void;
  onShowRequestManager?: () => void;
  onShowCallRecords?: () => void;
  onShowLeaderboard?: () => void;
  onShowFollowUps?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onClose, 
  userRole, 
  initialIsAdding = false, 
  initialEditingDonor = null, 
  onShowUserManagement,
  onShowRequestManager,
  onShowCallRecords,
  onShowLeaderboard,
  onShowFollowUps,
}) => {
  const [editingDonor, setEditingDonor] = useState<Donor | null>(initialEditingDonor);
  const [isAdding, setIsAdding] = useState(initialIsAdding);
  const [showSIPConfig, setShowSIPConfig] = useState(false);
  const [showSMTPConfig, setShowSMTPConfig] = useState(false);
  const [showFacebookRequests, setShowFacebookRequests] = useState(false);
  const [sipStatus, setSipStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState(0);
  
  const isMainAdmin = auth.currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL;
  const canDelete = userRole === 'admin' || isMainAdmin;

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
    { id: 'add-donor', label: 'ডোনার যোগ করুন', icon: Plus, color: 'from-emerald-600 to-teal-600', onClick: () => setIsAdding(true), show: true },
    { id: 'leaderboard', label: 'লিডারবোর্ড', icon: Trophy, color: 'from-purple-600 to-indigo-600', onClick: onShowLeaderboard, show: true },
    { id: 'facebook-requests', label: 'ফেসবুক রিকোয়েস্ট', icon: Facebook, color: 'from-blue-600 to-blue-700', onClick: () => setShowFacebookRequests(true), show: userRole === 'admin' },
    { id: 'users', label: 'ইউজার ম্যানেজমেন্ট', icon: Users, color: 'from-blue-600 to-cyan-600', onClick: onShowUserManagement, show: userRole === 'admin' },
    { id: 'requests', label: 'রিকোয়েস্ট ম্যানেজার', icon: ClipboardList, color: 'from-orange-600 to-amber-600', onClick: onShowRequestManager, show: userRole === 'admin' },
    { id: 'calls', label: 'কল রেকর্ডস', icon: PhoneCall, color: 'from-teal-600 to-emerald-600', onClick: onShowCallRecords, show: userRole === 'admin' },
    { id: 'followups', label: 'ফলোআপ কল', icon: PhoneCall, color: 'from-rose-600 to-pink-600', onClick: onShowFollowUps, show: userRole === 'admin' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-white dark:bg-slate-900 w-full max-w-5xl h-fit max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-300"
      >
        
        {/* Header Section */}
        <div className="bg-emerald-900 dark:bg-slate-950 p-6 sm:p-8 text-white relative overflow-hidden shrink-0 transition-colors duration-300">
          {/* Static Background Elements */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500 rounded-full opacity-10 blur-[60px]" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-500 rounded-full opacity-5 blur-[60px]" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-3 rounded-2xl border border-white/10 shadow-inner">
                <Shield size={32} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">অ্যাডমিন প্যানেল</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">
                    System Control
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* SIP Status Indicator */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black border transition-all ${
                  sipStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  sipStatus === 'connecting' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {sipStatus === 'connected' ? <Wifi size={14} /> : 
                 sipStatus === 'connecting' ? <Loader2 size={14} className="animate-spin" /> : 
                 <WifiOff size={14} />}
                <span className="hidden sm:inline tracking-widest">
                  {sipStatus === 'connected' ? 'SIP ONLINE' : 
                   sipStatus === 'connecting' ? 'CONNECTING...' : 
                   'SIP OFFLINE'}
                </span>
              </motion.div>

              {isMainAdmin && (
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSIPConfig(true)} 
                  className="p-3 bg-white/5 text-white rounded-xl transition-all border border-white/10"
                  title="SIP সেটিংস"
                >
                  <Settings size={18} />
                </motion.button>
              )}

              {isMainAdmin && (
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSMTPConfig(true)} 
                  className="p-3 bg-white/5 text-white rounded-xl transition-all border border-white/10"
                  title="SMTP সেটিংস"
                >
                  <Mail size={18} />
                </motion.button>
              )}
              
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(239,68,68,0.2)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose} 
                className="p-3 bg-white/5 text-white rounded-xl transition-all border border-white/10"
              >
                <X size={18} />
              </motion.button>
            </div>
          </div>

          {/* Admin Menu Tabs - Refined Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 relative z-10">
            {menuItems.filter(item => item.show).map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ 
                  y: -2, 
                  boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.2)"
                }}
                whileTap={{ scale: 0.98 }}
                onClick={item.onClick}
                className={`group relative flex flex-col items-center justify-center p-5 rounded-[2rem] bg-gradient-to-br ${item.color} text-white shadow-xl transition-all border border-white/10 overflow-hidden`}
              >
                {item.id === 'followups' && pendingFollowUpsCount > 0 && (
                  <div className="absolute top-3 right-3 bg-white text-rose-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    {pendingFollowUpsCount}
                  </div>
                )}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="bg-white/10 p-4 rounded-2xl mb-3 group-hover:scale-110 transition-transform duration-200">
                  <item.icon size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight opacity-80 group-hover:opacity-100">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Add Donor Modal */}
      <AnimatePresence>
        {isAdding && (
          <AddDonorModal 
            onClose={() => setIsAdding(false)} 
            onAdd={() => {}} 
          />
        )}
      </AnimatePresence>

      {/* SIP Config Modal */}
      <AnimatePresence>
        {showSIPConfig && isMainAdmin && (
          <SIPConfigModal onClose={() => setShowSIPConfig(false)} />
        )}
      </AnimatePresence>

      {/* SMTP Config Modal */}
      <AnimatePresence>
        {showSMTPConfig && isMainAdmin && (
          <SMTPConfigModal onClose={() => setShowSMTPConfig(false)} />
        )}
      </AnimatePresence>

      {/* Facebook Requests Modal */}
      <AnimatePresence>
        {showFacebookRequests && userRole === 'admin' && (
          <FacebookRequestsPanel onClose={() => setShowFacebookRequests(false)} />
        )}
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

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {/* Delete confirmation logic removed as donor list is removed from AdminPanel */}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
