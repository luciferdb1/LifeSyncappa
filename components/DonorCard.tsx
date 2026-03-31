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
  if (count >= 50) return { title: 'কিংবদন্তি দাতা', icon: <Crown size={12} className="text-yellow-500" />, bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  if (count >= 30) return { title: 'মানবতার বাতিঘর', icon: <Star size={12} className="text-purple-500" />, bg: 'bg-purple-100 text-purple-800 border-purple-200' };
  if (count >= 20) return { title: 'রক্ত সৈনিক', icon: <Shield size={12} className="text-red-500" />, bg: 'bg-red-100 text-red-800 border-red-200' };
  if (count >= 10) return { title: 'জীবন সারথি', icon: <Heart size={12} className="text-rose-500" />, bg: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (count >= 5) return { title: 'উৎসর্গকারী', icon: <Medal size={12} className="text-blue-500" />, bg: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (count >= 1) return { title: 'শুভেচ্ছা দূত', icon: <Award size={12} className="text-emerald-500" />, bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  return null;
};

const DonorCard: React.FC<DonorCardProps> = ({ donor, onNameClick, onEdit, canEdit, onRecordDonation, onCall }) => {
  const hasDonatedBefore = !!donor.lastDonationDate && donor.lastDonationDate !== "";
  
  let diffDays = 0;
  let isDateEligible = true;
  let formattedNextDate = "প্রস্তুত";
  let remainingDays = 0;

  if (hasDonatedBefore) {
    const lastDate = new Date(donor.lastDonationDate);
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
    formattedNextDate = nextAvailableDate.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Calculate remaining days if not eligible
    remainingDays = 120 - diffDays;
  }

  // Default isAvailable to true for older records that don't have this field
  const isDonorAvailable = donor.isAvailable !== false;

  // Main eligibility logic: Must be marked available AND meet date criteria (120 days / 4 months)
  const isEligible = isDonorAvailable && isDateEligible;

  const handleCallLog = () => {
    logActivity(donor.id, 'call', donor.name, 'কল করার জন্য বাটনে ক্লিক করা হয়েছে');
  };

  const donorTitleInfo = getDonorTitle(donor.totalDonations);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ 
        y: -4, 
        boxShadow: "0 12px 24px -8px rgba(5, 150, 105, 0.15)"
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 500 }}
      className={`group bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm transition-all duration-300 ease-out overflow-hidden border border-emerald-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 flex flex-col h-full ${!isDonorAvailable ? 'opacity-80 grayscale-[0.3]' : ''}`}
    >
      <div className={`relative h-1.5 transition-colors duration-500 ${isEligible ? 'bg-gradient-to-r from-emerald-600 to-green-400' : 'bg-gray-200 dark:bg-slate-800'}`}></div>
      
      <div className="p-4 flex-1">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h3 
                  onClick={() => {
                    if (canEdit && onEdit) {
                      onEdit(donor);
                    } else {
                      onNameClick?.(donor);
                    }
                  }}
                  className="text-lg font-bold text-emerald-950 dark:text-emerald-50 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors cursor-pointer hover:underline truncate max-w-full"
                  title={donor.name}
                >
                  {donor.name}
                </h3>
                {donorTitleInfo && (
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-sm whitespace-nowrap ${donorTitleInfo.bg} dark:bg-opacity-20`}>
                    {donorTitleInfo.icon}
                    {donorTitleInfo.title}
                  </div>
                )}
              </div>
              <div className="flex items-center text-emerald-700/70 dark:text-emerald-400/70 text-xs font-medium truncate">
                <MapPin size={12} className="mr-1 text-emerald-500 shrink-0" />
                {donor.location}
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full shadow-sm transition-colors duration-500 border-2 ${isEligible ? 'bg-white dark:bg-slate-800 text-red-600 border-red-100 dark:border-red-900/30 shadow-red-100 dark:shadow-none' : 'bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-slate-700'}`}>
                  <span className="font-extrabold text-lg">{donor.bloodGroup}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg p-3 transition-colors group-hover:bg-emerald-50/60 dark:group-hover:bg-emerald-900/20 border border-emerald-100/30 dark:border-emerald-800/30">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center text-emerald-800/60 dark:text-emerald-400/60">
                  <Calendar size={14} className="mr-1.5 text-emerald-500" />
                  <span>শেষ দান</span>
              </div>
              <span className="font-bold text-emerald-900 dark:text-emerald-100">{hasDonatedBefore ? donor.lastDonationDate : 'এখনও দেননি'}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center text-emerald-800/60 dark:text-emerald-400/60">
                  <Award size={14} className="mr-1.5 text-emerald-500" />
                  <span>মোট দান</span>
              </div>
              <span className="font-bold text-emerald-900 dark:text-emerald-100 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-slate-700 shadow-xs">{donor.totalDonations} বার</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-100/30 dark:border-emerald-800/30">
              <div className="flex items-center text-emerald-800/60 dark:text-emerald-400/60">
                  <Clock size={14} className="mr-1.5 text-emerald-500" />
                  <span>পরবর্তী দান</span>
              </div>
              <span className={`font-bold ${isDateEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {formattedNextDate}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between h-7">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${isDonorAvailable}-${isDateEligible}`}
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={{ 
                  opacity: 1, 
                  scale: [0.9, 1.05, 1],
                  y: 0
                }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                whileHover={{ scale: 1.02 }}
                transition={{ 
                  duration: 0.4, 
                  times: [0, 0.6, 1],
                  ease: "easeOut" 
                }}
                className="w-full cursor-default"
              >
                {!isDonorAvailable ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 w-full justify-center">
                    <Ban size={10} className="mr-1" />
                    অনুপলব্ধ
                  </span>
                ) : isDateEligible ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shadow-xs w-full justify-center">
                    <span className="relative flex h-1.5 w-1.5 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                    </span>
                    রক্ত দিতে পারবেন
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900/20 w-full justify-center">
                    <Clock size={10} className="mr-1" />
                    অপেক্ষমান ({remainingDays > 0 ? remainingDays : 0} দিন)
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="p-3 pt-0 mt-auto flex gap-2">
          {isEligible ? (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  if (onCall) {
                    onCall(donor);
                  } else {
                    // Fallback for cases where onCall is not provided
                    // @ts-ignore
                    if (window.Android && window.Android.makeSipCall) {
                      const callerUid = auth.currentUser?.uid || 'unknown';
                      const callerName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Admin';
                      // @ts-ignore
                      window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
                    } else {
                      // @ts-ignore
                      if (window.showAppAlert) {
                        // @ts-ignore
                        window.showAppAlert("SIP কলিং শুধুমাত্র অ্যান্ড্রয়েড অ্যাপ থেকে সমর্থিত। অনুগ্রহ করে অ্যাপ ব্যবহার করুন।");
                      }
                    }
                  }
                }}
                className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-300 shadow-md shadow-red-100 dark:shadow-none hover:shadow-red-200 active:scale-95"
              >
                <Phone size={16} fill="currentColor" className="animate-pulse" />
                <span className="text-sm">কল করুন</span>
              </button>
          ) : (
              <button 
                disabled
                className="flex-1 flex items-center justify-center space-x-2 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 font-bold py-2.5 px-4 rounded-lg cursor-not-allowed transition-colors border border-gray-100 dark:border-slate-700"
              >
                <Phone size={16} />
                <span className="text-sm">
                  {!isDonorAvailable ? 'অনুপলব্ধ' : 'অপেক্ষমান'}
                </span>
              </button>
          )}
          {onRecordDonation && (
            <button
              onClick={() => onRecordDonation(donor)}
              className="flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold py-2.5 px-4 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800/30 shrink-0"
              title="রক্ত দিয়েছে"
            >
              <Droplet size={18} fill="currentColor" />
            </button>
          )}
        </div>
      </motion.div>
  );
};

export default DonorCard;