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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="bg-blue-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center transition-colors duration-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle size={20} />
            তথ্য সংশোধনের অনুরোধ
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-800 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 transition-colors duration-300">
          {success ? (
            <div className="text-center py-8">
              <div className="bg-emerald-100 dark:bg-emerald-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="text-emerald-600 dark:text-emerald-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-200 mb-2">অনুরোধ পাঠানো হয়েছে!</h3>
              <p className="text-gray-500 dark:text-slate-400">অ্যাডমিন আপনার অনুরোধটি পর্যালোচনা করবেন।</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-4 transition-colors duration-300">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">ডোনার: <span className="font-bold">{donor.name}</span></p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">রক্তের গ্রুপ: {donor.bloodGroup}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">অনুরোধের ধরন</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType('edit')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      type === 'edit' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    তথ্য পরিবর্তন
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('delete')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      type === 'delete' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    তথ্য মুছে ফেলা
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">বিস্তারিত তথ্য</label>
                <textarea
                  required
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={type === 'edit' ? "কি কি ভুল আছে এবং সঠিক তথ্য কি হবে তা লিখুন..." : "কেন এই তথ্যটি মুছে ফেলতে চান তা লিখুন..."}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> অনুরোধ পাঠান</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestModal;
