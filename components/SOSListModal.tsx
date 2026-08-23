import React, { useState } from 'react';
import { X, Phone, MapPin, Droplet, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { SOSRequest } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CreateSOSModal from './CreateSOSModal';

interface SOSListModalProps {
  activeSOS: SOSRequest[];
  onClose: () => void;
}

const SOSListModal: React.FC<SOSListModalProps> = ({ activeSOS, onClose }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const markResolved = async (id: string) => {
    try {
      await updateDoc(doc(db, 'sos_requests', id), {
        status: 'resolved'
      });
    } catch (e) {
      console.error(e);
      alert("Failed to mark as resolved.");
    }
  };

  const handleCall = (phone: string) => {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Android && window.Android.makeSipCall) {
      // @ts-ignore
      window.Android.makeSipCall(phone, "Emergency Contact", "", "");
    } else {
      window.location.href = `tel:${phone}`;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[999999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-red-100 dark:border-red-900/30 flex flex-col my-8">
            <div className="p-6 bg-red-50 dark:bg-red-900/20 flex justify-between items-center border-b border-red-100 dark:border-red-900/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center text-red-600 dark:text-red-300">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-red-900 dark:text-red-400">Emergency Requests</h2>
                  <p className="text-xs text-red-600 dark:text-red-500 font-bold uppercase tracking-wider">Active Blood Needs</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors shrink-0">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full mb-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
            >
              <Droplet size={18} />
              Submit New Emergency Request
            </button>

            {activeSOS.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4 opacity-50" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No active emergency requests right now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSOS.map((sos) => (
                  <div key={sos.id} className="bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/30 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-bl-full -z-0"></div>
                    <div className="relative z-10 flex flex-col md:flex-row gap-4 justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-lg text-sm font-black flex items-center gap-1">
                            <Droplet size={14} /> {sos.bloodGroup}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold text-lg">
                            {sos.patientName}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <MapPin size={14} /> {sos.location}
                        </div>
                        {sos.details && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg mt-2">
                            {sos.details}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 flex items-center gap-1 pt-1">
                          <Clock size={12} /> {new Date(sos.createdAt).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex flex-row md:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleCall(sos.phone)}
                          className="flex-1 md:flex-none bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <Phone size={16} /> Call
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure this request is resolved?")) {
                              markResolved(sos.id!);
                            }
                          }}
                          className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <CheckCircle size={16} /> Resolved
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateSOSModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
};

export default SOSListModal;
