import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Donor } from '../types';
import { X, Send, AlertCircle, Loader2 } from 'lucide-react';

interface RequestModalProps {
  donor: Donor;
  onClose: () => void;
}

const RequestModal: React.FC<RequestModalProps> = ({ donor, onClose }) => {
  const [type, setType] = useState<'edit' | 'delete'>('edit');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'requests'), {
        donorId: donor.id,
        donorName: donor.name,
        type,
        details,
        status: 'pending',
        userEmail: auth.currentUser?.email,
        userUid: auth.currentUser?.uid,
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        <div className="bg-blue-900 dark:bg-slate-950 p-5 text-white flex justify-between items-center shrink-0 transition-colors duration-300 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl shadow-inner border border-white/10">
              <AlertCircle size={24} className="text-blue-300" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Request Update</h3>
              <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest mt-0.5">An admin will review your request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-5 sm:p-8 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          <div className="max-w-2xl mx-auto">
            {success ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-emerald-50 dark:border-slate-800 p-8 animate-in zoom-in-95 duration-300">
                <div className="bg-emerald-100 dark:bg-emerald-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="text-emerald-600 dark:text-emerald-400" size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Request Sent!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Thank you for helping us keep the database accurate. An admin will review your request shortly.</p>
                <button 
                  onClick={onClose}
                  className="mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs"
                >
                  Back to Home
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl border-2 border-blue-100 dark:border-blue-900/30">
                      {donor.bloodGroup}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Donor Information</p>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white">{donor.name}</h4>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Request Type</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setType('edit')}
                          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${
                            type === 'edit' 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-900/30'
                          }`}
                        >
                          Change Info
                        </button>
                        <button
                          type="button"
                          onClick={() => setType('delete')}
                          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${
                            type === 'delete' 
                            ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-500/20' 
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-red-200 dark:hover:border-red-900/30'
                          }`}
                        >
                          Delete Info
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Details</label>
                      <textarea 
                        required
                        placeholder={type === 'edit' ? "What information needs to be changed? (e.g., Phone number is now 017...)" : "Why should this donor be removed? (e.g., Moved to another city, Passed away, etc.)"}
                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-blue-500 dark:focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800 dark:text-slate-200 font-medium min-h-[150px] resize-none"
                        value={details}
                        onChange={e => setDetails(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading || !details.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-sm disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  Submit Request
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;
