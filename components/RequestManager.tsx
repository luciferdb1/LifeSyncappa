import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { logActivity } from '../services/logService';
import { Request, UserProfile, Donor } from '../types';
import { ClipboardList, Check, X, Loader2, Trash2, MessageSquare, Clock, User, AlertCircle } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import DonorCard from './DonorCard';

interface RequestManagerProps {
  onClose: () => void;
  onEditDonor?: (donor: Donor) => void;
}

const RequestManager: React.FC<RequestManagerProps> = ({ onClose, onEditDonor }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [loadingDonor, setLoadingDonor] = useState(false);

  const handleDonorClick = async (donorId: string) => {
    setLoadingDonor(true);
    try {
      const docRef = doc(db, 'donors', donorId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedDonor({ id: docSnap.id, ...docSnap.data() } as Donor);
      } else {
        alert("Donor not found or has been deleted.");
      }
    } catch (error) {
      console.error("Error fetching donor", error);
      alert("Failed to load donor details.");
    } finally {
      setLoadingDonor(false);
    }
  };

  useEffect(() => {
    // Fetch users for mapping userUid to profile
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const map: Record<string, UserProfile> = {};
        usersSnapshot.forEach(userDoc => {
          map[userDoc.id] = userDoc.data() as UserProfile;
        });
        setUsersMap(map);
      } catch (error) {
        console.error("Error fetching users for request manager:", error);
      }
    };
    fetchUsers();
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
    }, (error: any) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'requests');
      }
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
          `Request ${newStatus === 'approved' ? 'approved' : 'rejected'} (Request type: ${request.type === 'edit' ? 'edit' : 'delete'})`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${requestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteRequestId) return;
    setProcessingId(deleteRequestId);
    try {
      await deleteDoc(doc(db, 'requests', deleteRequestId));
      setDeleteRequestId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `requests/${deleteRequestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <div className="bg-blue-900 dark:bg-slate-950 p-4 text-white flex justify-between items-center transition-colors duration-300">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList size={18} />
            Request Management
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-800 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32} />
              <p className="text-gray-500 dark:text-slate-400">Loading...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
              <ClipboardList size={64} className="opacity-20 mb-4" />
              <p>No requests found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {requests.map((req, index) => (
                <div key={req.id} className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-emerald-100 dark:border-slate-700 flex flex-col transition-all hover:shadow-md hover:border-emerald-200 dark:hover:border-slate-600 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest ${
                      req.type === 'edit' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {req.type === 'edit' ? 'Edit Request' : 'Delete Request'}
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest ${
                      req.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 
                      req.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 
                      'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                    }`}>
                      {req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>

                  <h3 
                    className="text-lg font-black text-slate-800 dark:text-white mb-1 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleDonorClick(req.donorId)}
                  >
                    {req.donorName}
                  </h3>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <button 
                      onClick={() => {
                        const profile = usersMap[req.userUid];
                        if (profile) setSelectedProfile(profile);
                      }}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 font-bold bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-md transition-colors"
                    >
                      <User size={12} /> {usersMap[req.userUid]?.displayName || req.userEmail}
                    </button>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-bold">
                      <Clock size={10} /> {new Date(req.createdAt).toLocaleDateString('en-US')}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 mb-5 flex-1 line-clamp-4">
                    {req.details}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                       {req.status === 'pending' && (
                        <>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleStatusChange(req.id, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-50"
                            title="Approve"
                          >
                            {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          </button>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleStatusChange(req.id, 'rejected')}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-50"
                            title="Reject"
                          >
                            {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Donor Card Modal */}
      {selectedDonor && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-300 p-4">
            <button 
              onClick={() => setSelectedDonor(null)} 
              className="absolute top-6 right-6 z-10 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg text-slate-500 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
            <DonorCard 
              donor={selectedDonor} 
              onNameClick={() => {}} 
              canEdit={false} 
            />
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedProfile && (
        <UserProfileModal user={selectedProfile} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
};

export default RequestManager;
