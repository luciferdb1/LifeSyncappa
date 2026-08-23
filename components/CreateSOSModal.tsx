import React, { useState } from 'react';
import { X, Droplet, MapPin, Phone, User, FileText, Loader2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BLOOD_GROUPS_LIST } from '../constants';
import { auth } from '../firebase';

interface CreateSOSModalProps {
  onClose: () => void;
}

const CreateSOSModal: React.FC<CreateSOSModalProps> = ({ onClose }) => {
  const [patientName, setPatientName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'sos_requests'), {
        patientName,
        bloodGroup,
        location,
        phone,
        details,
        status: 'active',
        createdAt: new Date().toISOString(),
        submittedByUid: auth.currentUser?.uid || 'anonymous',
      });
      alert('Emergency request submitted successfully.');
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-red-100 dark:border-red-900/30 flex flex-col my-8">
          <div className="p-6 bg-red-600 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
              <Droplet size={24} />
              <h2 className="text-xl font-black">Submit SOS Request</h2>
            </div>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors shrink-0">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <User size={12} /> Patient Name *
            </label>
            <input
              type="text"
              required
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all dark:text-white"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Droplet size={12} /> Blood Group *
            </label>
            <select
              required
              value={bloodGroup}
              onChange={e => setBloodGroup(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all dark:text-white"
            >
              <option value="">Select Group</option>
              {BLOOD_GROUPS_LIST.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin size={12} /> Location (Hospital/Clinic) *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all dark:text-white"
              placeholder="Hospital name, City"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Phone size={12} /> Contact Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all dark:text-white"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText size={12} /> Additional Details
            </label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all dark:text-white resize-none"
              placeholder="How many bags needed, urgency, etc."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Submit SOS Request'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

export default CreateSOSModal;
