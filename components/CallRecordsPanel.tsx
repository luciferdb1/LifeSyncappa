import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { CallRecord } from '../types';
import { Trash2, Play, Pause, FastForward, Loader2, PhoneCall, Calendar, Clock, User, AlertTriangle, Search } from 'lucide-react';

const CallRecordsPanel: React.FC = () => {
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
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
                <PhoneCall className="text-emerald-600 dark:text-emerald-400" size={24} />
              </div>
              কল রেকর্ডস
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">সকল ডোনার কলের রেকর্ডিং এখানে সংরক্ষিত আছে</p>
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

      <div className="flex-1 overflow-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 shadow-sm">
              <tr className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">তারিখ ও সময়</th>
                <th className="p-4">কলকারী</th>
                <th className="p-4">ডোনার</th>
                <th className="p-4">রেকর্ডিং</th>
                <th className="p-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <div className="flex flex-col items-center text-gray-400 dark:text-slate-500">
                    <PhoneCall size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">কোনো কল রেকর্ড পাওয়া যায়নি</p>
                    <p className="text-sm">সার্চ টার্ম পরিবর্তন করে চেষ্টা করুন</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, index) => (
                <tr key={record.id} className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/50 dark:bg-slate-800/30'}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-slate-300">
                      <Calendar size={14} className="text-emerald-500 dark:text-emerald-400" />
                      {new Date(record.timestamp).toLocaleDateString('bn-BD')}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-1">
                      <Clock size={12} />
                      {new Date(record.timestamp).toLocaleTimeString('bn-BD')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                        <User size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{record.callerName}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter">এডিটর</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{record.donorName}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-mono mt-0.5 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">{record.donorPhone}</div>
                  </td>
                  <td className="p-4">
                    {record.audioUrl ? (
                      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-all">
                        <button 
                          onClick={() => togglePlay(record)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            playingId === record.id ? 'bg-emerald-600 text-white scale-110 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          }`}
                        >
                          {playingId === record.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                        </button>
                        
                        <div className="flex flex-col min-w-[60px]">
                          <span className="text-xs font-bold text-gray-700 dark:text-slate-300">{formatDuration(record.duration)}</span>
                          {playingId === record.id && (
                            <button 
                              onClick={changeSpeed}
                              className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 rounded-full w-fit"
                            >
                              <FastForward size={10} />
                              {playbackRate}x
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                        অডিও মুছে ফেলা হয়েছে
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {record.audioUrl && (
                      <button 
                        onClick={() => setDeleteRecord(record)}
                        className="p-2 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="অডিও মুছুন"
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
