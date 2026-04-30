import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Donor, BloodGroup } from '../types';
import { X, Save, Loader2, User, Phone, MapPin, Calendar, Droplet, Hash, Plus, AlertTriangle } from 'lucide-react';
import { BLOOD_GROUPS_LIST } from '../constants';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment, getDoc, query, where, getDocs } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import { syncDonorToGoogleSheet } from '../services/googleSheetsService';

interface AddDonorModalProps {
  onClose: () => void;
  onAdd: () => void;
}

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

  // Parse current value for initial search term
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term if not a valid option
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
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 cursor-text"
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
                className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer text-slate-700 dark:text-slate-300 font-medium transition-colors"
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

const AddDonorModal: React.FC<AddDonorModalProps> = ({ onClose, onAdd }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [newDonor, setNewDonor] = useState<Partial<Donor>>({
    bloodGroup: BloodGroup.A_POS,
    totalDonations: 0
  });

  const [districts, setDistricts] = useState<{district: string, districtbn: string}[]>([]);
  const [upazilas, setUpazilas] = useState<{upazila: string, upazilabn: string}[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');

  useEffect(() => {
    fetch('https://bdapis.com/api/v1.1/districts')
      .then(res => res.json())
      .then(data => {
         if (data?.data) {
           // Sort districts alphabetically
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

  // Update newDonor location when district/upazila changes
  useEffect(() => {
    if (selectedDistrict && selectedUpazila) {
      setNewDonor(prev => ({...prev, location: `${selectedUpazila}, ${selectedDistrict}`}));
    } else if (selectedDistrict) {
      setNewDonor(prev => ({...prev, location: selectedDistrict}));
    } else {
      setNewDonor(prev => ({...prev, location: ''}));
    }
  }, [selectedDistrict, selectedUpazila]);

  const handleAddNew = async () => {
    if (!newDonor.name || !newDonor.phone || !newDonor.location) {
      alert("Please fill in all information (Name, Phone, Location)");
      return;
    }

    if (!newDonor.phone.startsWith('01') || newDonor.phone.length !== 11) {
      alert("Please enter a valid 11-digit phone number (e.g., 01xxxxxxxxx)");
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
        isAvailable: true,
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
      
      await logActivity(docRef.id, 'create', newDonor.name, 'New donor added');

      // Sync to Google Sheets
      await syncDonorToGoogleSheet('add', { id: docRef.id, ...donorData });

      // Leaderboard Logic: Award 20 points for adding a donor (Only for Volunteers)
      if (auth.currentUser?.uid) {
        const volunteerRef = doc(db, 'users', auth.currentUser.uid);
        const volunteerSnap = await getDoc(volunteerRef);
        if (volunteerSnap.exists() && volunteerSnap.data().role === 'volunteer') {
          await updateDoc(volunteerRef, {
            points: increment(20),
            pointsFromAdding: increment(20),
            donorsAdded: increment(1)
          });
        } else if (volunteerSnap.exists()) {
           // still increment donorsAdded for non-volunteers maybe? Requirements said only volunteer gets points.
           await updateDoc(volunteerRef, {
            donorsAdded: increment(1)
          });
        }
      }
      
      onAdd();
      onClose();
    } catch (error: any) {
      console.error("Error adding donor:", error);
      let errorMessage = "Error adding donor.";
      
      if (error.message && error.message.includes('permission-denied')) {
        errorMessage = "You do not have permission to add this information.";
      } else if (error.message && error.message.includes('offline')) {
        errorMessage = "No internet connection. Please check.";
      }
      
      alert(errorMessage);
      handleFirestoreError(error, OperationType.CREATE, 'donors');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Header - Sticky */}
        <div className="bg-emerald-900 dark:bg-slate-950 p-4 sm:p-5 text-white flex justify-between items-center shrink-0 transition-colors duration-300 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl shadow-inner border border-white/10">
              <Plus size={24} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Add New Donor</h3>
              <p className="text-emerald-200/60 text-[10px] font-black uppercase tracking-widest mt-0.5">Please fill in the form with accurate information</p>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="p-2 rounded-xl transition-all"
          >
            <X size={20} />
          </motion.button>
        </div>

        <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <User size={12} className="text-emerald-600 dark:text-emerald-400" /> Donor Name
              </label>
              <input 
                type="text" 
                placeholder="Enter full name"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                onChange={e => setNewDonor({...newDonor, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Phone Field */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Phone size={12} className="text-emerald-600 dark:text-emerald-400" /> Phone Number
                </label>
                <input 
                  type="tel" 
                  placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  value={newDonor.phone || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewDonor({...newDonor, phone: val});
                  }} 
                />
              </div>

              {/* Blood Group */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Droplet size={12} className="text-red-500" /> Blood Group
                </label>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-black appearance-none cursor-pointer" 
                    onChange={e => setNewDonor({...newDonor, bloodGroup: e.target.value as BloodGroup})}
                    defaultValue={BloodGroup.A_POS}
                  >
                    {BLOOD_GROUPS_LIST.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400 dark:text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <MapPin size={12} className="text-emerald-600 dark:text-emerald-400" /> District
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
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <MapPin size={12} className="text-teal-600 dark:text-teal-400" /> Upazila / Area
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
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 disabled:opacity-50"
                      value={selectedUpazila}
                      onChange={e => setSelectedUpazila(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pb-6">
              {/* Last Donation Date */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Calendar size={12} className="text-emerald-600 dark:text-emerald-400" /> Last Donation (Optional)
                </label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                  onChange={e => setNewDonor({...newDonor, lastDonationDate: e.target.value})} 
                />
              </div>

              {/* Total Donations */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  <Hash size={12} className="text-emerald-600 dark:text-emerald-400" /> Total Donations
                </label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-base text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  onChange={e => setNewDonor({...newDonor, totalDonations: parseInt(e.target.value) || 0})} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions - Sticky */}
        <div className="mt-auto p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 shrink-0 transition-colors duration-300 w-full z-50">
          <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row gap-3">
            <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: '#059669' }}
              whileTap={{ scale: 0.99 }}
              onClick={handleAddNew} 
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black shadow-lg shadow-emerald-500/10 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save
            </motion.button>
            <button 
              onClick={onClose}
              className="flex-1 py-3 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-400 transition-colors uppercase tracking-widest text-xs border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-xl"
            >
              Cancel
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
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-amber-100 dark:border-amber-900/30 transition-colors duration-300"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col items-center text-center">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-full mb-2 shadow-sm">
                <AlertTriangle className="text-amber-500" size={24} />
              </div>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200 mb-0.5 tracking-tight">Duplicate Number!</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold leading-relaxed">This donor is already added.</p>
            </div>
            <div className="p-3">
              <button 
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full bg-amber-500 text-white py-2.5 rounded-xl font-black shadow-lg shadow-amber-100 dark:shadow-none hover:bg-amber-600 transition-all active:scale-95 text-sm"
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

export default AddDonorModal;
