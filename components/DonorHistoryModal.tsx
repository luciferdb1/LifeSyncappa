import React, { useState, useEffect } from 'react';
import { Donor, ActivityLog } from '../types';
import { X, Clock, User, Phone, Edit3, Trash2, Plus, Loader2 } from 'lucide-react';
import { subscribeToDonorLogs } from '../services/logService';

interface DonorHistoryModalProps {
  donor: Donor;
  onClose: () => void;
}

const DonorHistoryModal: React.FC<DonorHistoryModalProps> = ({ donor, onClose }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToDonorLogs(donor.id, (fetchedLogs) => {
      setLogs(fetchedLogs);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [donor.id]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'call': return <Phone size={14} className="text-blue-500" />;
      case 'update': return <Edit3 size={14} className="text-amber-500" />;
      case 'delete': return <Trash2 size={14} className="text-red-500" />;
      case 'create': return <Plus size={14} className="text-emerald-500" />;
      default: return <Clock size={14} className="text-gray-500" />;
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'call': return 'কল করা হয়েছে';
      case 'update': return 'তথ্য আপডেট করা হয়েছে';
      case 'delete': return 'মুছে ফেলা হয়েছে';
      case 'create': return 'যোগ করা হয়েছে';
      default: return action;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-emerald-100 dark:border-slate-800 transition-colors duration-300">
        <div className="bg-emerald-800 dark:bg-slate-950 p-5 text-white flex justify-between items-center transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 dark:bg-slate-800 p-2 rounded-xl">
              <Clock size={20} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">অ্যাক্টিভিটি লগ</h3>
              <p className="text-emerald-300/70 text-[10px] uppercase tracking-wider">{donor.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-700 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900 transition-colors duration-300">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={24} />
              <p className="text-xs text-gray-500 dark:text-slate-400">লোড হচ্ছে...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={log.id} className="relative pl-6 pb-4 border-l border-emerald-100 dark:border-slate-800 last:pb-0">
                  <div className="absolute left-[-7px] top-0 bg-white dark:bg-slate-900 p-0.5 transition-colors duration-300">
                    <div className="bg-emerald-50 dark:bg-slate-800 p-1 rounded-full border border-emerald-100 dark:border-slate-700">
                      {getActionIcon(log.action)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-gray-100 dark:border-slate-800 transition-colors duration-300">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-400">{getActionText(log.action)}</span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">
                        {new Date(log.timestamp).toLocaleString('bn-BD', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-slate-400 mb-1">
                      <User size={10} className="text-gray-400 dark:text-slate-500" />
                      <span className="font-medium">{log.userEmail}</span>
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-500 italic leading-relaxed">
                        "{log.details}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Clock size={32} className="text-gray-200 dark:text-slate-800 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-slate-500">কোনো লগ পাওয়া যায়নি</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors duration-300">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 font-bold rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonorHistoryModal;
