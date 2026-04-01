import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { CallRecord } from '../types';
import { Trash2, Play, Pause, FastForward, Loader2, PhoneCall, Calendar, Clock, User, AlertTriangle, Search, X } from 'lucide-react';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Auto-cleanup records older than 3 months
    const cleanupOldRecords = async () => {
      try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const oldRecordsQuery = query(
          collection(db, 'callRecords'), 
          where('timestamp', '<', threeMonthsAgo.toISOString())
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
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'callRecords');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'callRecords');
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
      
      // Update Firestore to remove audio link but keep history
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

  const filteredRecords = records.filter(r => 
    r.donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.donorPhone.includes(searchTerm) ||
    r.callerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDuration = records.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col h-full transition-colors duration-300">
      <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-600 dark:text-slate-400" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
                  <PhoneCall className="text-emerald-600 dark:text-emerald-400" size={24} />
                </div>
                কল রেকর্ডস
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">সকল ডোনার কলের রেকর্ডিং এখানে সংরক্ষিত আছে</p>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">মোট কল</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{records.length}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">মোট সময়</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={20} />
          <input 
            type="text"
            placeholder="ডোনারের নাম, ফোন নম্বর বা কলকারীর নাম দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none transition-all shadow-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-8 pb-32">
        <div className="space-y-6">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                  <tr className="text-gray-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="p-6">তারিখ ও সময়</th>
                    <th className="p-6">কলকারী</th>
                    <th className="p-6">ডোনার</th>
                    <th className="p-6">রেকর্ডিং</th>
                    <th className="p-6 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center text-gray-400 dark:text-slate-500">
                          <PhoneCall size={64} className="mb-6 opacity-10" />
                          <p className="text-xl font-black tracking-tighter">কোনো কল রেকর্ড পাওয়া যায়নি</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr key={record.id} className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all group ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                        <td className="p-6">
                          <div className="flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-300">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-lg">
                              <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            {new Date(record.timestamp).toLocaleDateString('bn-BD')}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 ml-1">
                            <Clock size={12} />
                            {new Date(record.timestamp).toLocaleTimeString('bn-BD')}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                              <User size={20} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900 dark:text-white">{record.callerName}</span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-[0.2em] mt-0.5">এডিটর</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">{record.donorName}</div>
                          <div className="text-[10px] text-slate-400 font-black tracking-[0.15em] mt-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">{record.donorPhone}</div>
                        </td>
                        <td className="p-6">
                          {record.audioUrl ? (
                            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2.5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 group-hover:border-emerald-400 transition-all w-fit shadow-sm">
                              <button 
                                onClick={() => togglePlay(record)}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
                                  playingId === record.id 
                                    ? 'bg-rose-600 text-white scale-110 shadow-rose-200 dark:shadow-none rotate-12' 
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 shadow-emerald-200 dark:shadow-none'
                                }`}
                              >
                                {playingId === record.id ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                              </button>
                              
                              <div className="flex flex-col pr-4">
                                <span className="text-xs font-black text-slate-900 dark:text-white">{formatDuration(record.duration)}</span>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <button 
                                    onClick={changeSpeed}
                                    className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors"
                                  >
                                    {playbackRate}x SPEED
                                  </button>
                                  {playingId === record.id && (
                                    <div className="flex gap-0.5">
                                      {[1,2,3].map(i => (
                                        <motion.div 
                                          key={i}
                                          animate={{ height: [4, 12, 4] }}
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
                            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-100 dark:border-rose-900/20">
                              <AlertTriangle size={12} />
                              অডিও মুছে ফেলা হয়েছে
                            </div>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          {record.audioUrl && (
                            <button 
                              onClick={() => setDeleteRecord(record)}
                              className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={20} />
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
          <div className="lg:hidden space-y-4">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">কোনো রেকর্ড নেই</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-100 dark:border-slate-800 space-y-6 transform transition-all active:scale-[0.98]">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                        <User size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{record.callerName}</h3>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-[0.2em] mt-0.5">এডিটর</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{new Date(record.timestamp).toLocaleDateString('bn-BD')}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{new Date(record.timestamp).toLocaleTimeString('bn-BD')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{record.donorName}</h4>
                        <p className="text-xs font-black text-slate-400 tracking-widest mt-1">{record.donorPhone}</p>
                      </div>
                      {record.audioUrl && (
                        <button 
                          onClick={() => setDeleteRecord(record)}
                          className="p-3 text-slate-300 hover:text-rose-600 bg-white dark:bg-slate-900 rounded-2xl shadow-sm transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>

                    {record.audioUrl ? (
                      <div className="flex items-center gap-5 bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => togglePlay(record)}
                          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-90 ${
                            playingId === record.id 
                              ? 'bg-rose-600 text-white rotate-12 shadow-rose-200' 
                              : 'bg-emerald-600 text-white shadow-emerald-200'
                          }`}
                        >
                          {playingId === record.id ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{formatDuration(record.duration)}</span>
                            <button 
                              onClick={changeSpeed} 
                              className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-1.5 rounded-full active:bg-emerald-100"
                            >
                              {playbackRate}x
                            </button>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                      <div className="text-center py-6 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-900/30">
                        অডিও ফাইল মুছে ফেলা হয়েছে
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
             <div className="bg-red-50 dark:bg-red-900/10 p-8 flex flex-col items-center text-center border-b border-red-50 dark:border-red-900/20">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-full mb-4 shadow-sm">
                   <AlertTriangle className="text-red-500 dark:text-red-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">আপনি কি নিশ্চিত?</h3>
                <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                  এই কল রেকর্ডটির অডিও মুছে ফেলা হবে।<br/>হিস্ট্রি থেকে যাবে কিন্তু অডিও শোনা যাবে না।
                </p>
             </div>
             <div className="p-4 bg-white dark:bg-slate-900 flex gap-3 justify-center">
                <button 
                  onClick={() => setDeleteRecord(null)}
                  className="flex-1 px-5 py-2.5 rounded-xl text-gray-600 dark:text-slate-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 transition-all"
                >
                  বাতিল
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className={`flex-1 px-5 py-2.5 rounded-xl text-white font-bold shadow-lg shadow-red-200 dark:shadow-red-900/20 transition-all transform hover:-translate-y-0.5 ${isDeleting ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {isDeleting ? 'মুছছে...' : 'মুছে ফেলুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallRecordsPanel;
