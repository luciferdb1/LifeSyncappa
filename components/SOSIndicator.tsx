import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, Siren } from 'lucide-react';
import { SOSRequest } from '../types';
import SOSListModal from './SOSListModal';
import { motion, AnimatePresence } from 'motion/react';

const SOSIndicator = () => {
  const [activeSOS, setActiveSOS] = useState<SOSRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'sos_requests'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sosList: SOSRequest[] = [];
      snapshot.forEach((doc) => {
        sosList.push({ id: doc.id, ...doc.data() } as SOSRequest);
      });
      // Sort by createdAt desc locally since we can't always compound query without index
      sosList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Play a sound or show browser notification if a new one is added
      if (sosList.length > activeSOS.length && activeSOS.length > 0) {
         if ("Notification" in window && Notification.permission === "granted") {
           new Notification("New Blood Emergency!", {
             body: `Urgent blood needed: ${sosList[0].bloodGroup} at ${sosList[0].location}`,
             icon: "/logo.png"
           });
         }
      }
      
      setActiveSOS(sosList);
    });

    return () => unsubscribe();
  }, [activeSOS.length]);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`relative p-2 rounded-2xl transition-all duration-300 active:scale-90 ${activeSOS.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        title="Emergency Requests"
      >
        <Siren size={22} className={activeSOS.length > 0 ? 'animate-pulse drop-shadow-md' : ''} />
        <AnimatePresence>
          {activeSOS.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg"
            >
              {activeSOS.length}
            </motion.span>
          )}
        </AnimatePresence>
        
        {activeSOS.length > 0 && (
          <div className="absolute inset-0 rounded-2xl bg-red-400/20 animate-ping pointer-events-none"></div>
        )}
      </button>

      {isModalOpen && (
        <SOSListModal
          activeSOS={activeSOS}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

export default SOSIndicator;
