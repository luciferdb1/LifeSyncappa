import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { CallRecord, UserProfile } from '../types';
import { Trash2, Play, Pause, FastForward, Loader2, PhoneCall, Calendar, Clock, User, AlertTriangle, Search, X, ArrowUpDown } from 'lucide-react';
import UserProfileModal from './UserProfileModal';

interface CallRecordsPanelProps {
  onClose?: () => void;
}

const CallRecordsPanel: React.FC<CallRecordsPanelProps> = ({ onClose }) => {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [deleteRecord, setDeleteRecord] = useState<CallRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Fetch users for mapping callerUid to displayName
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const map: Record<string, UserProfile> = {};
        usersSnapshot.forEach(doc => {
          const data = doc.data() as UserProfile;
          if (data.displayName) {
            map[doc.id] = data;
          }
        });
        setUsersMap(map);
      } catch (error) {
        console.error("Error fetching users for call records:", error);
      }
    };
    fetchUsers();

    // Auto-cleanup records older than 1 month
    const cleanupOldRecords = async () => {
      try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const oldRecordsQuery = query(
          collection(db, 'callRecords'), 
          where('timestamp', '<', oneMonthAgo.toISOString())
        );
        
        const snapshot = await getDocs(oldRecordsQuery);
        snapshot.forEach(async (docSnapshot) => {
          const data = docSnapshot.data() as CallRecord;
          if (data.storagePath && !data.storagePath.startsWith('mock/')) {
            const storageRef = ref(storage, data.storagePath);
            await deleteObject(storageRef).catch(e => {
              if (e.code !== 'storage/object-not-found') {
                handleFirestoreError(e, OperationType.DELETE, data.storagePath || 'unknown');
              }
            });
          }
          await deleteDoc(doc(db, 'callRecords', docSnapshot.id));
        });
      } catch (error: any) {
        if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.LIST, 'callRecords');
        }
      }
    };
    
    cleanupOldRecords();

    const q = query(collection(db, 'callRecords'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: CallRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as CallRecord);
      });
      setRecords(recordsData);
      setLoading(false);
    }, (error: any) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'callRecords');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const confirmDelete = async () => {
    if (!deleteRecord) return;
    
    setIsDeleting(true);
    try {
      // Delete from Storage
      if (deleteRecord.storagePath && !deleteRecord.storagePath.startsWith('mock/')) {
        const storageRef = ref(storage, deleteRecord.storagePath);
        await deleteObject(storageRef).catch(e => {
          if (e.code !== 'storage/object-not-found') {
            console.error("Storage delete error:", e);
          }
        });
      }
      
      // Keep history but remove audio
      await updateDoc(doc(db, 'callRecords', deleteRecord.id), {
        audioUrl: null,
        storagePath: null
      });
      setDeleteRecord(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `callRecords/${deleteRecord.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePlay = (record: CallRecord) => {
    if (playingId === record.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = record.audioUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play();
        setPlayingId(record.id);
      }
    }
  };

  const changeSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const filteredRecords = records.filter(r => {
    const callerInfo = usersMap[r.callerUid];
    // Exclude volunteer call records
    if (callerInfo?.role === 'volunteer') {
      return false;
    }
    const callerName = callerInfo?.displayName || r.callerName || 'Unknown User';
    return r.donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.donorPhone.includes(searchTerm) ||
    callerName.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const totalDuration = records.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col h-full transition-colors duration-300">
      <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div className="flex items-center gap-2">
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-600 dark:text-slate-400" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-lg">
                  <PhoneCall className="text-emerald-600 dark:text-emerald-400" size={16} />
                </div>
                Call Records
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">All donor call recordings are stored here</p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center min-w-[70px]">
              <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Total Calls</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{records.length}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center min-w-[70px]">
              <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Total Time</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="Search by donor name, phone number or caller name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none transition-all shadow-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
          </div>
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0"
          >
            <ArrowUpDown size={14} className="text-gray-500 dark:text-slate-400" />
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300">
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </span>
          </button>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />

      <div className="flex-1 overflow-auto p-2 sm:p-3 pb-20">
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                  <tr className="text-gray-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                    <th className="p-2">Date & Time</th>
                    <th className="p-2">Caller</th>
                    <th className="p-2">Donor</th>
                    <th className="p-2">Recording</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center">
                        <div className="flex flex-col items-center text-gray-400 dark:text-slate-500">
                          <PhoneCall size={32} className="mb-3 opacity-10" />
                          <p className="text-base font-bold tracking-tight">No call records found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr key={record.id} className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all group ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-md">
                              <Calendar size={10} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            {new Date(record.timestamp).toLocaleDateString('en-US')}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 ml-1">
                            <Clock size={8} />
                            {new Date(record.timestamp).toLocaleTimeString('en-US')}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {usersMap[record.callerUid]?.photoUrl ? (
                              <img src={usersMap[record.callerUid].photoUrl} alt="Caller" className="w-6 h-6 rounded-lg object-cover shadow-sm" />
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200 dark:shadow-none">
                                <User size={12} />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <button onClick={() => setSelectedProfile(usersMap[record.callerUid])} className="text-left text-xs font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                {usersMap[record.callerUid]?.displayName || record.callerName || 'Unknown User'}
                              </button>
                              <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Editor</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">{record.donorName}</div>
                          <div className="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">{record.donorPhone}</div>
                        </td>
                        <td className="p-2">
                          {record.audioUrl ? (
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 group-hover:border-emerald-400 transition-all w-fit shadow-sm">
                              <button 
                                onClick={() => togglePlay(record)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                  playingId === record.id 
                                    ? 'bg-rose-600 text-white scale-105 shadow-rose-200 dark:shadow-none' 
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 shadow-emerald-200 dark:shadow-none'
                                }`}
                              >
                                {playingId === record.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                              </button>
                              
                              <div className="flex flex-col pr-2">
                                <span className="text-[10px] font-bold text-slate-900 dark:text-white">{formatDuration(record.duration)}</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <button 
                                    onClick={changeSpeed}
                                    className="text-[8px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors"
                                  >
                                    {playbackRate}x
                                  </button>
                                  {playingId === record.id && (
                                    <div className="flex gap-0.5">
                                      {[1,2,3].map(i => (
                                        <motion.div 
                                          key={i}
                                          animate={{ height: [2, 6, 2] }}
                                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                          className="w-0.5 bg-emerald-500 rounded-full"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-rose-100 dark:border-rose-900/20">
                              <AlertTriangle size={8} />
                              Audio Deleted
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {record.audioUrl && (
                            <button 
                              onClick={() => setDeleteRecord(record)}
                              className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">No records found</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transform transition-all active:scale-[0.98]">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {usersMap[record.callerUid]?.photoUrl ? (
                        <img src={usersMap[record.callerUid].photoUrl} alt="Caller" className="w-8 h-8 rounded-xl object-cover shadow-sm" />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200 dark:shadow-none">
                          <User size={16} />
                        </div>
                      )}
                      <div>
                        <button onClick={() => setSelectedProfile(usersMap[record.callerUid])} className="text-left text-xs font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          {usersMap[record.callerUid]?.displayName || record.callerName || 'Unknown User'}
                        </button>
                        <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Editor</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg">
                        <p className="text-[8px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">{new Date(record.timestamp).toLocaleDateString('en-US')}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{new Date(record.timestamp).toLocaleTimeString('en-US')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{record.donorName}</h4>
                        <p className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">{record.donorPhone}</p>
                      </div>
                      {record.audioUrl && (
                        <button 
                          onClick={() => setDeleteRecord(record)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-900 rounded-xl shadow-sm transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {record.audioUrl ? (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => togglePlay(record)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all transform active:scale-95 ${
                            playingId === record.id 
                              ? 'bg-rose-600 text-white scale-105 shadow-rose-200' 
                              : 'bg-emerald-600 text-white shadow-emerald-200'
                          }`}
                        >
                          {playingId === record.id ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
                        </button>
                        <div className="flex-1 pr-1.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-900 dark:text-white">{formatDuration(record.duration)}</span>
                            <button 
                              onClick={changeSpeed} 
                              className="text-[8px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full active:bg-emerald-100"
                            >
                              {playbackRate}x
                            </button>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: playingId === record.id ? '100%' : '0%' }}
                              transition={{ duration: record.duration, ease: "linear" }}
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-[8px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-dashed border-rose-200 dark:border-rose-900/30">
                        Audio file deleted
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800">
             <div className="bg-red-50 dark:bg-red-900/10 p-6 flex flex-col items-center text-center border-b border-red-50 dark:border-red-900/20">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-full mb-3 shadow-sm">
                   <AlertTriangle className="text-red-500 dark:text-red-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Are you sure?</h3>
                <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed">
                  The audio for this call record will be deleted.<br/>The history will remain but the audio will not be playable.
                </p>
             </div>
             <div className="p-3 bg-white dark:bg-slate-900 flex gap-2 justify-center">
                <button 
                  onClick={() => setDeleteRecord(null)}
                  className="flex-1 px-4 py-2 rounded-xl text-gray-600 dark:text-slate-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className={`flex-1 px-4 py-2 rounded-xl text-white text-sm font-bold shadow-lg shadow-red-200 dark:shadow-red-900/20 transition-all transform hover:-translate-y-0.5 ${isDeleting ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
             </div>
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

export default CallRecordsPanel;
