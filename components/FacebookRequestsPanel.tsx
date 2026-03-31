import React, { useState, useEffect } from 'react';
import { X, Loader2, MessageSquare, Clock, CheckCircle, Trash2, Facebook } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface FacebookRequest {
  id: string;
  facebookId: string;
  senderName: string;
  message?: string;
  timestamp: string;
  status: 'new' | 'processing' | 'completed';
  payload?: string;
}

interface FacebookRequestsPanelProps {
  onClose: () => void;
}

const FacebookRequestsPanel: React.FC<FacebookRequestsPanelProps> = ({ onClose }) => {
  const [requests, setRequests] = useState<FacebookRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'facebookRequests'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestList: FacebookRequest[] = [];
      snapshot.forEach((doc) => {
        requestList.push({ id: doc.id, ...doc.data() } as FacebookRequest);
      });
      setRequests(requestList);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'facebookRequests');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'new' | 'processing' | 'completed') => {
    try {
      await updateDoc(doc(db, 'facebookRequests', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `facebookRequests/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে আপনি এই রিকোয়েস্টটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'facebookRequests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `facebookRequests/${id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl h-full max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-300"
      >
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Facebook size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">ফেসবুক ব্লাড রিকোয়েস্ট</h2>
              <p className="text-xs text-blue-100">ফেসবুক পেজ থেকে আসা সরাসরি রিকোয়েস্টসমূহ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
              <p className="text-gray-500">রিকোয়েস্ট লোড হচ্ছে...</p>
            </div>
          ) : requests.length > 0 ? (
            <div className="grid gap-4">
              {requests.map((request) => (
                <motion.div 
                  key={request.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-3xl border transition-all ${
                    request.status === 'completed' 
                      ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 opacity-75' 
                      : 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900/30 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          request.status === 'new' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          request.status === 'processing' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {request.status === 'new' ? 'নতুন' : 
                           request.status === 'processing' ? 'প্রসেসিং' : 'সম্পন্ন'}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(request.timestamp).toLocaleString('bn-BD')}
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <MessageSquare size={16} className="text-blue-500" />
                        {request.senderName}
                      </h4>
                      
                      <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        {request.message || 'কোনো মেসেজ নেই'}
                      </p>
                      
                      {request.payload && (
                        <div className="mt-2 text-[10px] font-mono text-gray-400 dark:text-slate-500">
                          Payload: {request.payload}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col gap-2 shrink-0">
                      {request.status !== 'completed' && (
                        <button 
                          onClick={() => handleUpdateStatus(request.id, request.status === 'new' ? 'processing' : 'completed')}
                          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            request.status === 'new' 
                              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <CheckCircle size={14} />
                          {request.status === 'new' ? 'প্রসেসিং শুরু করুন' : 'সম্পন্ন মার্ক করুন'}
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleDelete(request.id)}
                        className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors flex items-center justify-center"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-gray-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                <Facebook size={48} className="text-gray-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-600 dark:text-slate-400">কোনো রিকোয়েস্ট নেই</h3>
              <p className="text-sm text-gray-500 dark:text-slate-500">ফেসবুক পেজ থেকে এখনও কোনো ব্লাড রিকোয়েস্ট আসেনি।</p>
            </div>
          )}
        </div>
        
        {/* Footer Info */}
        <div className="p-6 bg-gray-50 dark:bg-slate-950/50 border-t border-gray-100 dark:border-slate-800 shrink-0">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <h5 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">সেটআপ গাইড</h5>
            <p className="text-[11px] text-blue-600 dark:text-blue-300 leading-relaxed">
              ফেসবুক ডেভেলপার পোর্টালে গিয়ে আপনার পেজের জন্য Webhook সেটআপ করুন। 
              Callback URL হিসেবে <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">/api/facebook/webhook</code> ব্যবহার করুন। 
              Verify Token হিসেবে <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">shishir_verify_token</code> ব্যবহার করুন।
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FacebookRequestsPanel;
