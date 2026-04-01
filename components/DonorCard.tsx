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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 40px -12px rgba(5, 150, 105, 0.2)"
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      className={`group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] p-6 transition-all duration-500 ease-out border border-emerald-100/50 dark:border-slate-800/50 hover:border-emerald-400 dark:hover:border-emerald-600 flex flex-col h-full ${!isDonorAvailable ? 'opacity-70 grayscale-[0.5]' : ''} soft-shadow`}
    >
      {/* Status Indicator Dot */}
      <div className="absolute top-6 right-6">
        <div className={`w-3 h-3 rounded-full ${isEligible ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
      </div>

      <div className="flex-1">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center w-16 h-16 rounded-2xl shadow-inner transition-all duration-500 border-2 ${isEligible ? 'bg-red-50 dark:bg-red-950/30 text-red-600 border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700'}`}>
                  <span className="font-black text-2xl font-outfit">{donor.bloodGroup}</span>
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
                  className="text-xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer hover:underline truncate font-outfit"
                  title={donor.name}
                >
                  {donor.name}
                </h3>
                <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">
                  <MapPin size={14} className="mr-1.5 text-emerald-500 shrink-0" />
                  <span className="truncate">{donor.location}</span>
                </div>
              </div>
            </div>

            {donorTitleInfo && (
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[11px] font-black border shadow-sm w-fit ${donorTitleInfo.bg} dark:bg-opacity-10 uppercase tracking-widest`}>
                {donorTitleInfo.icon}
                {donorTitleInfo.title}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-3 border border-slate-100/50 dark:border-slate-800/50">
              <div className="flex items-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">
                  <Calendar size={12} className="mr-1.5 text-emerald-500" />
                  <span>শেষ দান</span>
              </div>
              <p className="font-black text-slate-800 dark:text-slate-200 text-xs">{hasDonatedBefore ? donor.lastDonationDate : 'এখনও দেননি'}</p>
            </div>
            
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-3 border border-slate-100/50 dark:border-slate-800/50">
              <div className="flex items-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">
                  <Award size={12} className="mr-1.5 text-emerald-500" />
                  <span>মোট দান</span>
              </div>
              <p className="font-black text-emerald-600 dark:text-emerald-400 text-xs">{donor.totalDonations} বার</p>
            </div>
          </div>

          <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100/30 dark:border-emerald-800/30 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-emerald-800/60 dark:text-emerald-400/60 text-[10px] font-black uppercase tracking-widest">
                  <Clock size={14} className="mr-2 text-emerald-500" />
                  <span>পরবর্তী দান</span>
              </div>
              <span className={`font-black text-sm ${isDateEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {formattedNextDate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isEligible ? (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  if (onCall) {
                    onCall(donor);
                  } else {
                    // Fallback
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
                className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-red-500/20 active:scale-95 uppercase tracking-widest text-xs"
              >
                <Phone size={18} fill="currentColor" className="animate-pulse" />
                <span>কল করুন</span>
              </button>
          ) : (
              <button 
                disabled
                className="w-full flex items-center justify-center gap-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black py-4 rounded-2xl cursor-not-allowed transition-colors border border-slate-200 dark:border-slate-700 uppercase tracking-widest text-xs"
              >
                <Phone size={18} />
                <span>
                  {!isDonorAvailable ? 'অনুপলব্ধ' : 'অপেক্ষমান'}
                </span>
              </button>
          )}
          
          <div className="flex gap-3">
            {onRecordDonation && (
              <button
                onClick={() => onRecordDonation(donor)}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black py-3 rounded-2xl transition-all border border-emerald-200 dark:border-emerald-800/30 uppercase tracking-widest text-[10px]"
              >
                <Droplet size={14} fill="currentColor" />
                <span>রক্তদান রেকর্ড</span>
              </button>
            )}
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(donor)}
                className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black p-3 rounded-2xl transition-all border border-slate-200 dark:border-slate-700"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
  );
};

export default DonorCard;