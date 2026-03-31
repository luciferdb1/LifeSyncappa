import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, deleteDoc } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import { Request } from '../types';
import { ClipboardList, Check, X, Loader2, Trash2, MessageSquare, Clock } from 'lucide-react';

interface RequestManagerProps {
  onClose: () => void;
}

const RequestManager: React.FC<RequestManagerProps> = ({ onClose }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'requests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestList: Request[] = [];
      snapshot.forEach((doc) => {
        requestList.push({ id: doc.id, ...doc.data() } as Request);
      });
      // Sort by pending first, then by date
      requestList.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRequests(requestList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    try {
      const request = requests.find(r => r.id === requestId);
      await updateDoc(doc(db, 'requests', requestId), { status: newStatus });
      
      if (request) {
        await logActivity(
          request.donorId, 
          'update', 
          request.donorName, 
          `অনুরোধ ${newStatus === 'approved' ? 'গৃহীত' : 'প্রত্যাখ্যাত'} হয়েছে (অনুরোধ টাইপ: ${request.type === 'edit' ? 'সংশোধন' : 'মুছে ফেলা'})`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${requestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm("আপনি কি এই অনুরোধটি মুছে ফেলতে চান?")) return;
    setProcessingId(requestId);
    try {
      await deleteDoc(doc(db, 'requests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `requests/${requestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="bg-blue-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center transition-colors duration-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList size={20} />
            অনুরোধ ব্যবস্থাপনা
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-800 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32} />
              <p className="text-gray-500 dark:text-slate-400">লোড হচ্ছে...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
              <ClipboardList size={64} className="opacity-20 mb-4" />
              <p>কোনো অনুরোধ পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
                  <tr className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4">রিকোয়েস্টের ধরন</th>
                    <th className="p-4">ডোনার ও ইউজার</th>
                    <th className="p-4">বিস্তারিত</th>
                    <th className="p-4 text-center">স্ট্যাটাস</th>
                    <th className="p-4 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {requests.map((req, index) => (
                    <tr key={req.id} className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-900/50'}`}>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit ${
                            req.type === 'edit' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          }`}>
                            {req.type === 'edit' ? 'সংশোধন' : 'মুছে ফেলা'}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock size={10} /> {new Date(req.createdAt).toLocaleDateString('bn-BD')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <h3 className="font-bold text-gray-800 dark:text-slate-200 mb-1">{req.donorName}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-500 flex items-center gap-1">
                          <MessageSquare size={12} /> {req.userEmail}
                        </p>
                      </td>
                      <td className="p-4 align-top">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-sm text-gray-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 max-w-xs break-words">
                          {req.details}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block ${
                          req.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' : 
                          req.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 
                          'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}>
                          {req.status === 'pending' ? 'অপেক্ষমান' : req.status === 'approved' ? 'গৃহীত' : 'প্রত্যাখ্যাত'}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          {req.status === 'pending' && (
                            <>
                              <button
                                disabled={processingId === req.id}
                                onClick={() => handleStatusChange(req.id, 'approved')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                title="Approve"
                              >
                                {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                              </button>
                              <button
                                disabled={processingId === req.id}
                                onClick={() => handleStatusChange(req.id, 'rejected')}
                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                title="Reject"
                              >
                                {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                              </button>
                            </>
                          )}
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleDeleteRequest(req.id)}
                            className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 p-2 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            title="Delete Request"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestManager;
