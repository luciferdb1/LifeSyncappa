import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Donor, BloodGroup } from '../types';
import { X, Save, Trash2, AlertTriangle, Loader2, User, Phone, MapPin, Calendar, Droplet, Hash, Clock } from 'lucide-react';
import { BLOOD_GROUPS_LIST } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { updateDoc, deleteDoc, doc, getDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import { syncDonorToGoogleSheet } from '../services/googleSheetsService';
import DonorHistoryModal from './DonorHistoryModal';

interface EditDonorModalProps {
  donor: Donor;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

// Add the SearchableSelect component outside the main function
const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon
}: { 
  options: string[], 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string,
  icon?: any
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!options.includes(searchTerm)) {
          setSearchTerm(value);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, options, searchTerm, value]);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-sm text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 cursor-text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
              onChange('');
            }
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400 dark:text-slate-500">
           <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto hidden-scrollbar">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div
                key={i}
                className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
                onClick={() => {
                  setSearchTerm(opt);
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-slate-400 text-sm text-center">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

const EditDonorModal: React.FC<EditDonorModalProps> = ({ donor, onClose, onUpdate, onDelete, isAdmin }) => {
  const [form, setForm] = useState<Partial<Donor>>({ ...donor });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // States for districts/upazilas
  const [districts, setDistricts] = useState<{district: string, districtbn: string}[]>([]);
  const [upazilas, setUpazilas] = useState<{upazila: string, upazilabn: string}[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');

  // Setup initial location data
  useEffect(() => {
    if (donor.location) {
      const parts = donor.location.split(', ');
      if (parts.length === 2) {
        setSelectedUpazila(parts[0]);
        setSelectedDistrict(parts[1]);
      } else {
        setSelectedDistrict(donor.location);
      }
    }
  }, [donor]);

  useEffect(() => {
    fetch('https://bdapis.com/api/v1.1/districts')
      .then(res => res.json())
      .then(data => {
         if (data?.data) {
           const sorted = data.data.sort((a: any, b: any) => a.district.localeCompare(b.district));
           setDistricts(sorted);
         }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetch(`https://bdapis.com/api/v1.1/district/${selectedDistrict.toLowerCase()}`)
        .then(res => res.json())
        .then(data => {
           if (data?.data && data.data.length > 0) {
             const distData = data.data[0];
             if (distData.upazillas) {
                setUpazilas(distData.upazillas);
             } else {
                setUpazilas([]);
             }
           }
        })
        .catch(console.error);
    } else {
      setUpazilas([]);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedDistrict && selectedUpazila) {
      setForm(prev => ({...prev, location: `${selectedUpazila}, ${selectedDistrict}`}));
    } else if (selectedDistrict) {
      setForm(prev => ({...prev, location: selectedDistrict}));
    }
  }, [selectedDistrict, selectedUpazila]);

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.location) {
      alert("Please fill in all required information (Name, Phone, Location)");
      return;
    }

    if (!form.phone.startsWith('01') || form.phone.length !== 11) {
      alert("Please enter a valid 11-digit phone number (e.g., 01xxxxxxxxx)");
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
      
      await logActivity(donor.id, 'update', form.name, 'Donor information updated');

      // Leaderboard Logic: Award points to the volunteer who added the donor
      if (isDonationCompleted && donor.addedBy) {
        const volunteerRef = doc(db, 'users', donor.addedBy);
        const volunteerSnap = await getDoc(volunteerRef);
        if (volunteerSnap.exists() && volunteerSnap.data().role === 'volunteer') {
          const isOwnDonor = donor.addedBy === auth.currentUser?.uid;
          const pointsToAdd = isOwnDonor ? 10 : 5;
          const pointsField = isOwnDonor ? 'pointsFromOwnDonors' : 'pointsFromOtherDonors';
          await updateDoc(volunteerRef, {
            points: increment(pointsToAdd),
            [pointsField]: increment(pointsToAdd)
          });
        }
      }

      await syncDonorToGoogleSheet('update', { id: donor.id, ...updateData });
      
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error("Error updating donor:", error);
      let errorMessage = "Error updating information.";
      
      if (error.message && error.message.includes('permission-denied')) {
        errorMessage = "You do not have permission to change this information.";
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
      
      await logActivity(donor.id, 'delete', donor.name, 'Donor information deleted');
      await syncDonorToGoogleSheet('soft_delete', { id: donor.id });
      
      onDelete();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `donors/${donor.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="w-full h-full flex flex-col overflow-hidden"
      >
        {/* Header - Sticky */}
        <div className="bg-emerald-900 dark:bg-slate-950 p-4 sm:p-5 text-white flex justify-between items-center shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-2 rounded-xl shadow-inner border border-white/10">
              <User size={18} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Edit Donor Information</h3>
              <p className="text-emerald-200/60 text-[8px] font-black uppercase tracking-widest mt-0.5">Verify that the information is correct</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHistory(true)}
              className="p-2 rounded-xl transition-all text-emerald-300"
              title="Activity Log"
            >
              <Clock size={18} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              className="p-2 rounded-xl transition-all"
            >
              <X size={18} />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              <User size={10} className="text-emerald-600 dark:text-emerald-400" /> Donor Name
            </label>
            <input 
              type="text" 
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="Enter full name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Blood Group */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Droplet size={10} className="text-red-500" /> Blood Group
              </label>
              <div className="relative">
                <select 
                  value={form.bloodGroup}
                  onChange={e => setForm({...form, bloodGroup: e.target.value as BloodGroup})}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-black appearance-none cursor-pointer"
                >
                  {BLOOD_GROUPS_LIST.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
              <Phone size={10} className="text-emerald-600 dark:text-emerald-400" /> Phone Number
            </label>
            <input 
              type="tel" 
              value={form.phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setForm({...form, phone: val});
              }}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="01xxxxxxxxx"
            />
          </div>

          {/* Location Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <MapPin size={10} className="text-emerald-600 dark:text-emerald-400" /> District
              </label>
              <SearchableSelect 
                options={districts.map(d => d.district)}
                value={selectedDistrict}
                onChange={(val) => {
                  setSelectedDistrict(val);
                  setSelectedUpazila('');
                }}
                placeholder="Select District"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <MapPin size={10} className="text-teal-600 dark:text-teal-400" /> Upazila / Area
              </label>
              <div className="relative">
                {upazilas.length > 0 ? (
                  <SearchableSelect 
                    options={upazilas.map(u => u.upazila)}
                    value={selectedUpazila}
                    onChange={setSelectedUpazila}
                    placeholder="Select Upazila"
                  />
                ) : (
                  <input 
                    type="text" 
                    placeholder="e.g., Mirpur (Select District first)"
                    disabled={!selectedDistrict}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 disabled:opacity-50"
                    value={selectedUpazila}
                    onChange={e => setSelectedUpazila(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
            {/* Last Donation Date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Calendar size={10} className="text-emerald-600 dark:text-emerald-400" /> Last Donation (Optional)
              </label>
              <input 
                type="date" 
                value={form.lastDonationDate || ''}
                onChange={e => setForm({...form, lastDonationDate: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-bold cursor-pointer"
              />
            </div>

            {/* Total Donations */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <Hash size={10} className="text-emerald-600 dark:text-emerald-400" /> Total Donations
              </label>
              <input 
                type="number" 
                value={form.totalDonations}
                onChange={e => setForm({...form, totalDonations: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions - Sticky */}
        <div className="mt-auto p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 shrink-0 transition-colors duration-300 w-full z-50">
          <div className="flex gap-2">
            <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: '#059669' }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/10 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Information
            </motion.button>
            
            {isAdmin && (
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: '#fee2e2' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl transition-all border border-red-100 dark:border-red-900/30 disabled:opacity-50"
                title="Delete"
              >
                <Trash2 size={18} />
              </motion.button>
            )}
          </div>
          <button 
            onClick={onClose}
            className="w-full py-1 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-400 transition-colors uppercase tracking-widest text-[8px]"
          >
            Cancel
          </button>
        </div>
      </motion.div>

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200 transition-colors duration-300">
            <div className="bg-red-50 dark:bg-red-900/20 p-5 flex flex-col items-center text-center">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-full mb-3 shadow-sm">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-slate-200 mb-1">Are you sure?</h4>
              <p className="text-gray-500 dark:text-slate-400 text-xs">All information about this donor will be permanently deleted.</p>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <button 
                onClick={handleDelete}
                disabled={isSaving}
                className="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 text-gray-500 dark:text-slate-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                No, go back
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
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-amber-100 dark:border-amber-900/30 transition-colors duration-300"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 p-5 flex flex-col items-center text-center">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-full mb-3 shadow-sm">
                <AlertTriangle className="text-amber-500" size={24} />
              </div>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200 mb-1 tracking-tight">Duplicate Number!</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold leading-relaxed">This donor is already added.</p>
            </div>
            <div className="p-4">
              <button 
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-black shadow-lg shadow-amber-100 dark:shadow-none hover:bg-amber-600 transition-all active:scale-95"
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EditDonorModal;
