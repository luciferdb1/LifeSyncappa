import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Donor, BloodGroup } from '../types';
import { X, Save, Loader2, User, Phone, MapPin, Calendar, Droplet, Hash, Plus, AlertTriangle } from 'lucide-react';
import { BLOOD_GROUPS_LIST } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment, getDoc, query, where, getDocs } from 'firebase/firestore';
import { logActivity } from '../services/logService';

interface AddDonorModalProps {
  onClose: () => void;
  onAdd: () => void;
}

const AddDonorModal: React.FC<AddDonorModalProps> = ({ onClose, onAdd }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [newDonor, setNewDonor] = useState<Partial<Donor>>({
    bloodGroup: BloodGroup.A_POS,
    totalDonations: 0,
    isAvailable: true
  });

  const handleAddNew = async () => {
    if (!newDonor.name || !newDonor.phone || !newDonor.location) {
      alert("দয়া করে সকল তথ্য পূরণ করুন (নাম, ফোন, লোকেশন)");
      return;
    }

    if (!newDonor.phone.startsWith('01') || newDonor.phone.length !== 11) {
      alert("সঠিক ১১ ডিজিটের ফোন নাম্বার দিন (যেমন: 01xxxxxxxxx)");
      return;
    }

    setIsSaving(true);
    try {
      // Check for duplicate phone number
      const q = query(collection(db, 'donors'), where("phone", "==", newDonor.phone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setShowDuplicateWarning(true);
        setIsSaving(false);
        return;
      }

      let f3Status = 'completed';
      let f7Status = 'completed';
      
      if (newDonor.lastDonationDate) {
        f3Status = 'pending';
        f7Status = 'pending';
      }

      const donorData: any = {
        ...newDonor,
        lastDonationDate: newDonor.lastDonationDate || "",
        totalDonations: newDonor.totalDonations || 0,
        uid: auth.currentUser?.uid || "",
        addedBy: auth.currentUser?.uid || "",
        followUp3DayStatus: f3Status,
        followUp3DayNextReminder: '',
        followUp7DayStatus: f7Status,
        followUp7DayNextReminder: ''
      };

      // Remove undefined values to prevent Firestore errors
      Object.keys(donorData).forEach(key => {
        if (donorData[key] === undefined) {
          delete donorData[key];
        }
      });

      const docRef = await addDoc(collection(db, 'donors'), donorData);
      
      await logActivity(docRef.id, 'create', newDonor.name, 'নতুন রক্তদাতা যোগ করা হয়েছে');

      // Leaderboard Logic: Award 20 points for adding a donor (Only for Editors)
      if (auth.currentUser?.uid) {
        const volunteerRef = doc(db, 'users', auth.currentUser.uid);
        const volunteerSnap = await getDoc(volunteerRef);
        if (volunteerSnap.exists()) {
          await updateDoc(volunteerRef, {
            points: increment(20),
            pointsFromAdding: increment(20),
            donorsAdded: increment(1)
          });
        }
      }
      
      onAdd();
      onClose();
    } catch (error: any) {
      console.error("Error adding donor:", error);
      let errorMessage = "ডোনার যোগ করতে সমস্যা হয়েছে।";
      
      if (error.message && error.message.includes('permission-denied')) {
        errorMessage = "আপনার এই তথ্য যোগ করার অনুমতি নেই।";
      } else if (error.message && error.message.includes('offline')) {
        errorMessage = "ইন্টারনেট সংযোগ নেই। দয়া করে চেক করুন।";
      }
      
      alert(errorMessage);
      handleFirestoreError(error, OperationType.CREATE, 'donors');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 flex flex-col z-[70] overflow-hidden transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Header - Sticky */}
        <div className="bg-emerald-900 dark:bg-slate-950 p-6 sm:p-8 text-white flex justify-between items-center shrink-0 transition-colors duration-300 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl shadow-inner border border-white/10">
              <Plus size={28} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">নতুন রক্তদাতা যোগ করুন</h3>
              <p className="text-emerald-200/60 text-[10px] sm:text-[12px] font-black uppercase tracking-widest mt-1">সঠিক তথ্য দিয়ে ফরমটি পূরণ করুন</p>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="p-3 rounded-2xl transition-all"
          >
            <X size={24} />
          </motion.button>
        </div>

        <div className="flex-1 p-6 sm:p-12 space-y-8 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Name Field */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <User size={14} className="text-emerald-600 dark:text-emerald-400" /> রক্তদাতার নাম
              </label>
              <input 
                type="text" 
                placeholder="পুরো নাম লিখুন"
                className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                onChange={e => setNewDonor({...newDonor, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              {/* Phone Field */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Phone size={14} className="text-emerald-600 dark:text-emerald-400" /> ফোন নাম্বার
                </label>
                <input 
                  type="tel" 
                  placeholder="01xxxxxxxxx"
                  className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  value={newDonor.phone || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewDonor({...newDonor, phone: val});
                  }} 
                />
              </div>

              {/* Blood Group */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Droplet size={14} className="text-red-500" /> রক্তের গ্রুপ
                </label>
                <div className="relative">
                  <select 
                    className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-black appearance-none cursor-pointer" 
                    onChange={e => setNewDonor({...newDonor, bloodGroup: e.target.value as BloodGroup})}
                    defaultValue={BloodGroup.A_POS}
                  >
                    {BLOOD_GROUPS_LIST.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-6 pointer-events-none text-slate-400 dark:text-slate-500">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Field */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <MapPin size={14} className="text-emerald-600 dark:text-emerald-400" /> লোকেশন/এলাকা
              </label>
              <input 
                type="text" 
                placeholder="যেমন: ঢাকা, মিরপুর"
                className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                onChange={e => setNewDonor({...newDonor, location: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pb-12">
              {/* Last Donation Date */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" /> শেষ রক্তদান (ঐচ্ছিক)
                </label>
                <input 
                  type="date" 
                  className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                  onChange={e => setNewDonor({...newDonor, lastDonationDate: e.target.value})} 
                />
              </div>

              {/* Total Donations */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Hash size={14} className="text-emerald-600 dark:text-emerald-400" /> মোট দান
                </label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  onChange={e => setNewDonor({...newDonor, totalDonations: parseInt(e.target.value) || 0})} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions - Sticky */}
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 shrink-0 transition-colors duration-300">
          <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row gap-4">
            <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: '#059669' }}
              whileTap={{ scale: 0.99 }}
              onClick={handleAddNew} 
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/10 dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
            >
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              সংরক্ষণ করুন
            </motion.button>
            <button 
              onClick={onClose}
              className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-400 transition-colors uppercase tracking-widest text-xs sm:text-sm border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl"
            >
              বাতিল করুন
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden border border-amber-100 dark:border-amber-900/30 transition-colors duration-300"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 flex flex-col items-center text-center">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-full mb-4 shadow-sm">
                <AlertTriangle className="text-amber-500" size={32} />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1 tracking-tight">ডুপ্লিকেট নাম্বার!</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold leading-relaxed">ইতোমধ্যে এই ডোনার যুক্ত আছে।</p>
            </div>
            <div className="p-4">
              <button 
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full bg-amber-500 text-white py-3 rounded-xl font-black shadow-lg shadow-amber-100 dark:shadow-none hover:bg-amber-600 transition-all active:scale-95"
              >
                ঠিক আছে
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AddDonorModal;
