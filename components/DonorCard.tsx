import React from 'react';
import { Donor } from '../types';
import { Phone, Calendar, MapPin, Award, Clock, Ban, Edit3, Star, Medal, Crown, Shield, Heart, Droplet } from 'lucide-react';
import { logActivity } from '../services/logService';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface DonorCardProps {
  donor: Donor;
  onNameClick?: (donor: Donor) => void;
  onEdit?: (donor: Donor) => void;
  canEdit?: boolean;
  onRecordDonation?: (donor: Donor) => void;
  onCall?: (donor: Donor) => void;
}

const getDonorTitle = (count: number) => {
  if (count >= 50) return { title: 'Legendary Donor', icon: <Crown size={12} className="text-yellow-500" />, bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  if (count >= 30) return { title: 'Beacon of Humanity', icon: <Star size={12} className="text-purple-500" />, bg: 'bg-purple-100 text-purple-800 border-purple-200' };
  if (count >= 20) return { title: 'Blood Warrior', icon: <Shield size={12} className="text-red-500" />, bg: 'bg-red-100 text-red-800 border-red-200' };
  if (count >= 10) return { title: 'Life Savior', icon: <Heart size={12} className="text-rose-500" />, bg: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (count >= 5) return { title: 'Dedicated Donor', icon: <Medal size={12} className="text-blue-500" />, bg: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (count >= 1) return { title: 'Goodwill Ambassador', icon: <Award size={12} className="text-emerald-500" />, bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  return null;
};

const DonorCard: React.FC<DonorCardProps> = ({ donor, onNameClick, onEdit, canEdit, onRecordDonation, onCall }) => {
  let lastDonationText = donor.lastDonationDate;
  if (!donor.totalDonations || donor.totalDonations === 0) {
    lastDonationText = "Never Donated";
  } else if (donor.totalDonations > 0 && (!donor.lastDonationDate || donor.lastDonationDate === "")) {
    lastDonationText = "Not Specified";
  }

  const hasDonatedBefore = !!donor.lastDonationDate && donor.lastDonationDate !== "";
  
  let diffDays = 0;
  let isDateEligible = true;
  let formattedNextDate = "Ready";
  let remainingDays = 0;

  if (hasDonatedBefore) {
    const lastDate = new Date(donor.lastDonationDate);
    
    if (isNaN(lastDate.getTime())) {
      isDateEligible = true;
      formattedNextDate = "Available Now";
    } else {
      const today = new Date();
      
      // Calculate difference in milliseconds
      const diffTime = today.getTime() - lastDate.getTime();
      
      // Calculate difference in days
      diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // 120 days (approx 4 months) is the standard waiting period
      isDateEligible = diffDays >= 120;
      
      // Calculate next available date (Last Donation + 120 days)
      const nextAvailableDate = new Date(lastDate);
      nextAvailableDate.setDate(nextAvailableDate.getDate() + 120);
      
      // If diffDays is already >= 120, they are eligible now
      if (isDateEligible) {
        formattedNextDate = "Available Now";
      } else {
        formattedNextDate = nextAvailableDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        remainingDays = 120 - diffDays;
      }
    }
  } else {
    // If they have never donated, they are eligible
    isDateEligible = true;
    formattedNextDate = "Available Now";
  }

  // Main eligibility logic: Must meet date criteria (120 days / 4 months).
  const isEligible = isDateEligible;

  const handleCallLog = () => {
    logActivity(donor.id, 'call', donor.name, 'Call button clicked');
  };

  const donorTitleInfo = getDonorTitle(donor.totalDonations);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 40px -12px rgba(5, 150, 105, 0.2)"
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-4 transition-all duration-500 ease-out border border-emerald-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 flex flex-col h-full ${!isEligible ? 'opacity-80 grayscale-[0.2]' : ''} shadow-md hover:shadow-xl`}
    >
      {/* Status Indicator Dot */}
      <div className="absolute top-4 right-4">
        <AnimatePresence mode="wait">
          {isEligible ? (
            <motion.div
              key="eligible"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse"
            />
          ) : (
            <motion.div
              key="ineligible"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl shadow-inner transition-all duration-500 border-2 ${isEligible ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-100 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700'}`}>
                  <span className="font-bold text-2xl">{donor.bloodGroup}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 
                  onClick={() => {
                    if (canEdit && onEdit) {
                      onEdit(donor);
                    } else {
                      onNameClick?.(donor);
                    }
                  }}
                  className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer hover:underline truncate"
                  title={donor.name}
                >
                  {donor.name}
                </h3>
                <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">
                  <MapPin size={14} className="mr-1 text-emerald-500 shrink-0" />
                  <span className="truncate">{donor.location}</span>
                </div>
              </div>
            </div>

            {donorTitleInfo && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border shadow-sm w-fit ${donorTitleInfo.bg} dark:bg-opacity-10 uppercase tracking-wider`}>
                {donorTitleInfo.icon}
                {donorTitleInfo.title}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-2.5 border border-slate-100/50 dark:border-slate-800/50">
              <div className="flex items-center text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  <Calendar size={12} className="mr-1 text-emerald-500" />
                  <span>Last Donation</span>
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{lastDonationText}</p>
            </div>
            
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-2.5 border border-slate-100/50 dark:border-slate-800/50">
              <div className="flex items-center text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  <Award size={12} className="mr-1 text-emerald-500" />
                  <span>Total Donations</span>
              </div>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{donor.totalDonations} times</p>
            </div>
          </div>

          <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100/30 dark:border-emerald-800/30 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-emerald-800/60 dark:text-emerald-400/60 text-[9px] font-bold uppercase tracking-wider">
                  <Clock size={12} className="mr-1.5 text-emerald-500" />
                  <span>Next Donation</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.span 
                  key={isDateEligible ? 'eligible' : 'ineligible'}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className={`font-bold text-xs ${isDateEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}
                >
                  {formattedNextDate}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence mode="wait">
            {isEligible ? (
              <motion.button 
                key="call-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => {
                  e.preventDefault();
                  if (onCall) {
                    onCall(donor);
                  } else {
                    // Fallback
                    // @ts-ignore
                    if (window.Android && window.Android.makeSipCall) {
                      const callerUid = auth.currentUser?.uid || 'unknown';
                      const callerName = auth.currentUser?.displayName || 'Unknown User';
                      // @ts-ignore
                      window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
                    } else {
                      // @ts-ignore
                      if (window.showAppAlert) {
                        // @ts-ignore
                        window.showAppAlert("SIP calling is only supported from the Android app. Please use the app.");
                      }
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-sm shadow-red-500/20 active:scale-95 uppercase tracking-wider text-sm"
              >
                <Phone size={16} fill="currentColor" className="animate-pulse" />
                <span>Call</span>
              </motion.button>
            ) : (
              <motion.button 
                key="disabled-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                disabled
                className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold py-3 rounded-xl cursor-not-allowed transition-colors border border-slate-200 dark:border-slate-700 uppercase tracking-wider text-sm"
              >
                <Phone size={16} />
                <span>
                  Waiting
                </span>
              </motion.button>
            )}
          </AnimatePresence>
          
          <div className="flex gap-2">
            {onRecordDonation && (
              <button
                onClick={() => onRecordDonation(donor)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold py-3 rounded-xl transition-all border border-emerald-200 dark:border-emerald-800/30 uppercase tracking-wider text-xs"
              >
                <Droplet size={14} fill="currentColor" />
                <span>Record Donation</span>
              </button>
            )}
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(donor)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-sky-100 dark:bg-sky-900/20 hover:bg-sky-200 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-400 font-bold py-3 rounded-xl transition-all border border-sky-200 dark:border-sky-800/30 uppercase tracking-wider text-xs"
              >
                <Edit3 size={14} />
                <span>Edit Info</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
  );
};

export default DonorCard;