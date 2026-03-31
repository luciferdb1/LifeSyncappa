import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Donor, BloodGroup } from '../types';
import { X, Save, Trash2, AlertTriangle, Loader2, User, Phone, MapPin, Calendar, Droplet, Hash, Clock } from 'lucide-react';
import { BLOOD_GROUPS_LIST } from '../constants';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { updateDoc, deleteDoc, doc, getDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import DonorHistoryModal from './DonorHistoryModal';

interface EditDonorModalProps {
  donor: Donor;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

const EditDonorModal: React.FC<EditDonorModalProps> = ({ donor, onClose, onUpdate, onDelete, isAdmin }) => {
  const [form, setForm] = useState<Partial<Donor>>({ ...donor });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.location) {
      alert("দয়া করে প্রয়োজনীয় সকল তথ্য পূরণ করুন (নাম, ফোন, লোকেশন)");
      return;
    }

    if (!form.phone.startsWith('01') || form.phone.length !== 11) {
      alert("সঠিক ১১ ডিজিটের ফোন নাম্বার দিন (যেমন: 01xxxxxxxxx)");
      return;
    }

    setIsSaving(true);
    try {
      // Check for duplicate phone number (excluding current donor)
      const q = query(collection(db, 'donors'), where("phone", "==", form.phone));
      const querySnapshot = await getDocs(q);
      
      const isDuplicate = querySnapshot.docs.some(doc => doc.id !== donor.id);
      
      if (isDuplicate) {
        setShowDuplicateWarning(true);
        setIsSaving(false);
        return;
      }

      const donorRef = doc(db, 'donors', donor.id);
      const { id, ...updateData } = form;
      
      // Remove undefined values to prevent Firestore errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });
      
      // Ensure lastDonationDate is at least an empty string if undefined
      if (updateData.lastDonationDate === undefined) {
        updateData.lastDonationDate = "";
      }
      
      // If lastDonationDate changed, reset follow-up statuses
      if (updateData.lastDonationDate !== donor.lastDonationDate) {
        if (updateData.lastDonationDate) {
          updateData.followUp3DayStatus = 'pending';
          updateData.followUp3DayNextReminder = '';
          updateData.followUp7DayStatus = 'pending';
          updateData.followUp7DayNextReminder = '';
        } else {
          updateData.followUp3DayStatus = 'completed';
          updateData.followUp3DayNextReminder = '';
          updateData.followUp7DayStatus = 'completed';
          updateData.followUp7DayNextReminder = '';
        }
      }
      
      // Check if donation count increased
      const isDonationCompleted = form.totalDonations && form.totalDonations > donor.totalDonations;

      await updateDoc(donorRef, { ...updateData });
      
      await logActivity(donor.id, 'update', form.name, 'দাতার তথ্য আপডেট করা হয়েছে');

      // Leaderboard Logic: Award points to the volunteer who added the donor
      if (isDonationCompleted && donor.addedBy) {
        const volunteerRef = doc(db, 'users', donor.addedBy);
        const volunteerSnap = await getDoc(volunteerRef);
        if (volunteerSnap.exists()) {
          await updateDoc(volunteerRef, {
            points: increment(10)
          });
        }
      }
      
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error("Error updating donor:", error);
      let errorMessage = "তথ্য আপডেট করতে সমস্যা হয়েছে।";
      
      if (error.message && error.message.includes('permission-denied')) {
        errorMessage = "আপনার এই তথ্য পরিবর্তন করার অনুমতি নেই।";
      }
      
      alert(errorMessage);
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donor.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'donors', donor.id));
      
      await logActivity(donor.id, 'delete', donor.name, 'দাতার তথ্য মুছে ফেলা হয়েছে');
      
      onDelete();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `donors/${donor.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-colors duration-300"
      >
        {/* Header - Sticky */}
        <div className="bg-emerald-900 dark:bg-slate-950 p-5 sm:p-6 text-white flex justify-between items-center shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-2xl shadow-inner border border-white/10">
              <User size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">দাতার তথ্য পরিবর্তন</h3>
              <p className="text-emerald-200/60 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mt-0.5">তথ্যগুলো সঠিক কিনা যাচাই করে নিন</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHistory(true)}
              className="p-2.5 rounded-2xl transition-all text-emerald-300"
              title="অ্যাক্টিভিটি লগ"
            >
              <Clock size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              className="p-2.5 rounded-2xl transition-all"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 p-5 sm:p-8 space-y-6 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          {/* Name Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              <User size={12} className="text-emerald-600 dark:text-emerald-400" /> রক্তদাতার নাম
            </label>
            <input 
              type="text" 
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="পুরো নাম লিখুন"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {/* Blood Group */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Droplet size={12} className="text-red-500" /> রক্তের গ্রুপ
              </label>
              <div className="relative">
                <select 
                  value={form.bloodGroup}
                  onChange={e => setForm({...form, bloodGroup: e.target.value as BloodGroup})}
                  className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-black appearance-none cursor-pointer"
                >
                  {BLOOD_GROUPS_LIST.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <AlertTriangle size={12} className="text-amber-500" /> স্ট্যাটাস
              </label>
              <button 
                onClick={() => setForm({...form, isAvailable: !form.isAvailable})}
                className={`w-full px-5 py-3.5 rounded-2xl border-2 transition-all font-black flex items-center justify-center gap-3 ${
                  form.isAvailable 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${form.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`} />
                {form.isAvailable ? 'অ্যাভেইলেবল' : 'অ্যাভেইলেবল নয়'}
              </button>
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              <Phone size={12} className="text-emerald-600 dark:text-emerald-400" /> ফোন নাম্বার
            </label>
            <input 
              type="tel" 
              value={form.phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setForm({...form, phone: val});
              }}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="01xxxxxxxxx"
            />
          </div>

          {/* Location Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              <MapPin size={12} className="text-emerald-600 dark:text-emerald-400" /> লোকেশন/এলাকা
            </label>
            <input 
              type="text" 
              value={form.location}
              onChange={e => setForm({...form, location: e.target.value})}
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="যেমন: ঢাকা, মিরপুর"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pb-4">
            {/* Last Donation Date */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Calendar size={12} className="text-emerald-600 dark:text-emerald-400" /> শেষ রক্তদান (ঐচ্ছিক)
              </label>
              <input 
                type="date" 
                value={form.lastDonationDate || ''}
                onChange={e => setForm({...form, lastDonationDate: e.target.value})}
                className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
              />
            </div>

            {/* Total Donations */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Hash size={12} className="text-emerald-600 dark:text-emerald-400" /> মোট দান
              </label>
              <input 
                type="number" 
                value={form.totalDonations}
                onChange={e => setForm({...form, totalDonations: parseInt(e.target.value) || 0})}
                className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions - Sticky */}
        <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0 transition-colors duration-300">
          <div className="flex gap-3">
            <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: '#059669' }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-500/10 dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              তথ্য সেভ করুন
            </motion.button>
            
            {isAdmin && (
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: '#fee2e2' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3.5 rounded-2xl transition-all border border-red-100 dark:border-red-900/30 disabled:opacity-50"
                title="মুছে ফেলুন"
              >
                <Trash2 size={20} />
              </motion.button>
            )}
          </div>
          <button 
            onClick={onClose}
            className="w-full py-1.5 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-400 transition-colors uppercase tracking-widest text-[8px] sm:text-[9px]"
          >
            বাতিল করুন
          </button>
        </div>
      </motion.div>

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200 transition-colors duration-300">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 flex flex-col items-center text-center">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-full mb-4 shadow-sm">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-slate-200 mb-1">আপনি কি নিশ্চিত?</h4>
              <p className="text-gray-500 dark:text-slate-400 text-sm">এই দাতার সকল তথ্য চিরতরে মুছে যাবে।</p>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <button 
                onClick={handleDelete}
                disabled={isSaving}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'মুছছে...' : 'হ্যাঁ, মুছে ফেলুন'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-3 text-gray-500 dark:text-slate-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                না, ফিরে যান
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity History Overlay */}
      {showHistory && (
        <DonorHistoryModal 
          donor={donor} 
          onClose={() => setShowHistory(false)} 
        />
      )}

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

export default EditDonorModal;
