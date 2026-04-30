import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Image as ImageIcon, ExternalLink, Activity } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

interface SOSNotificationProps {
  userRole: string;
  followUpCount?: number;
}

const SOSNotification: React.FC<SOSNotificationProps> = ({ userRole, followUpCount = 0 }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [notifiedFollowUp, setNotifiedFollowUp] = useState(false);

  // Define roles that should see the notification
  const canApprove = ['admin', 'editor', 'president', 'secretary', 'media'].includes(userRole);

  useEffect(() => {
    if (!canApprove) return;
    
    // Request Android Overlay Permission for deep integrations
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Android && window.Android.requestOverlayPermission) {
       // @ts-ignore
       window.Android.requestOverlayPermission();
    }

    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const qPosters = query(collection(db, 'poster_submissions'), where('status', '==', 'pending'));
    const qRequests = query(collection(db, 'requests'), where('status', '==', 'pending'));

    const handleAddedDoc = (change: any, type: 'poster' | 'request') => {
      const data = change.doc.data();
      const timestamp = data.timestamp || data.createdAt;
      const isRecent = new Date(timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000;
      if (isRecent) {
         setNotifications(prev => {
            if (prev.find(n => n.id === change.doc.id)) return prev;
            return [...prev, { id: change.doc.id, notificationType: type, ...data }];
         });
         
         const title = type === 'poster' ? "Action Needed: Poster" : "Action Needed: Edit/Delete Request";
         const body = type === 'poster' 
           ? `A new poster for ${data.donorName || 'a donor'} is waiting for approval.`
           : `A new ${data.type} request for ${data.donorName || 'a donor'} is waiting for approval.`;
           
         // Trigger native Android overlay if interface exists
         // @ts-ignore
         if (typeof window !== 'undefined' && window.Android && window.Android.showOverlayEmergencyNotification) {
           // @ts-ignore
           window.Android.showOverlayEmergencyNotification(`Emergency: ${title}`, body);
         } else if ("Notification" in window && Notification.permission === "granted") {
           new Notification(`Emergency: ${title}`, {
             body: body,
             icon: "/logo.png",
             requireInteraction: true
           });
         }
      }
    };

    const unsubscribePosters = onSnapshot(qPosters, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') handleAddedDoc(change, 'poster');
        if (change.type === 'removed') setNotifications(prev => prev.filter(n => n.id !== change.doc.id));
      });
    });

    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') handleAddedDoc(change, 'request');
        if (change.type === 'removed') setNotifications(prev => prev.filter(n => n.id !== change.doc.id));
      });
    });

    return () => {
      unsubscribePosters();
      unsubscribeRequests();
    };
  }, [canApprove]);

  useEffect(() => {
    if (followUpCount > 0 && canApprove) {
      setNotifications(prev => {
        if (prev.find(n => n.id === 'follow_up_alert')) {
           // Update count if it's already there
           return prev.map(n => n.id === 'follow_up_alert' ? { ...n, count: followUpCount } : n);
        }
        
        if (!notifiedFollowUp) {
           // @ts-ignore
           if (typeof window !== 'undefined' && window.Android && window.Android.showOverlayEmergencyNotification) {
             // @ts-ignore
             window.Android.showOverlayEmergencyNotification("Emergency: Follow-up", `You have ${followUpCount} follow-up call(s) remaining.`);
           } else if ("Notification" in window && Notification.permission === "granted") {
             new Notification("Emergency: Follow-up Call Needed", {
               body: `You have ${followUpCount} follow-up call(s) remaining depending on donor's 3-day or 7-day schedule.`,
               icon: "/logo.png",
               requireInteraction: true
             });
           }
           setNotifiedFollowUp(true);
        }

        return [...prev, {
          id: 'follow_up_alert',
          type: 'followup',
          count: followUpCount,
        }];
      });
    } else {
      setNotifications(prev => prev.filter(n => n.id !== 'follow_up_alert'));
      if (followUpCount === 0) setNotifiedFollowUp(false);
    }
  }, [followUpCount, canApprove]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const triggerTest = () => {
    const testId = 'test_' + Date.now();
    setNotifications(prev => [...prev, {
      id: testId,
      donorName: 'Test Donor',
      submittedByName: 'Test Volunteer',
      timestamp: new Date().toISOString()
    }]);
    
    // Auto remove test notification after certain time
    setTimeout(() => dismissNotification(testId), 8000);
  };

  return (
    <>
      {canApprove && (
        <button 
          onClick={triggerTest}
          className="fixed bottom-4 left-4 z-50 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center sm:px-4 sm:rounded-xl"
          title="Test SOS Notification"
        >
          <Activity size={16} />
          <span className="hidden sm:inline ml-2 text-xs font-bold uppercase tracking-wider">Test SOS</span>
        </button>
      )}

      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-4 sm:px-0">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ x: 100, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="pointer-events-auto overflow-hidden rounded-2xl shadow-2xl relative"
            >
              {/* Animated Backdrop Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 animate-gradient-xy"></div>
              
              {/* Pulsing overlay */}
              <div className="absolute inset-0 bg-red-500/20 mix-blend-overlay animate-pulse"></div>

              <div className="relative z-10 p-5 glass-panel backdrop-blur-xl border border-white/20">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 text-white">
                    <div className="bg-white/20 p-2 rounded-full animate-pulse">
                      {notif.type === 'followup' ? <AlertTriangle size={24} className="text-white drop-shadow-md" /> : <AlertTriangle size={24} className="text-white drop-shadow-md" />}
                    </div>
                    <span className="text-xs font-black tracking-[0.2em] uppercase drop-shadow-md">
                       {notif.type === 'followup' ? 'Follow-Up Needed' : notif.notificationType === 'request' ? 'Request Pending' : 'New Poster Submission'}
                    </span>
                  </div>
                  <button 
                    onClick={() => dismissNotification(notif.id)}
                    className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <h3 className="text-white font-black text-lg leading-tight mb-1 drop-shadow-md">
                  {notif.type === 'followup' ? `You have ${notif.count} follow-up call(s)` : notif.notificationType === 'request' ? `${notif.type.toUpperCase()} Request for ${notif.donorName}` : `${notif.donorName}'s Poster Needs Approval`}
                </h3>
                <p className="text-white/80 text-sm font-medium drop-shadow-sm flex items-center gap-1.5">
                  {notif.type === 'followup' ? null : notif.notificationType === 'request' ? `Submitted by ${notif.userEmail}` : <><ImageIcon size={14} />Submitted by {notif.submittedByName}</>}
                </p>

                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => dismissNotification(notif.id)}
                    className="flex-1 bg-white hover:bg-slate-50 text-red-600 font-black uppercase tracking-widest text-[10px] py-2.5 rounded-xl shadow-lg transition-all active:scale-95"
                  >
                    Action Needed
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

export default SOSNotification;
