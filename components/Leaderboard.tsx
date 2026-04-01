import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Trophy, Medal, Award, X, Loader2, Users, Info, TrendingUp, Heart, PlusCircle, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LeaderboardProps {
  onClose: () => void;
  userRole: 'admin' | 'editor' | 'user' | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, userRole }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  
  const canSeeBreakdown = userRole === 'admin' || userRole === 'editor';

  useEffect(() => {
    // Query users, order by points descending
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        // Only include editors and users, exclude admins
        if (data.role !== 'admin') {
          userList.push(data);
        }
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeUsers = users.filter(u => (u.points || 0) > 0 || (u.donorsAdded || 0) > 0);
  const totalPoints = activeUsers.reduce((acc, curr) => acc + (curr.points || 0), 0);
  const topThree = activeUsers.slice(0, 3);
  
  const PointDistribution = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 p-6 rounded-2xl border border-purple-100 dark:border-slate-700 mb-6 shadow-sm transition-colors duration-300"
    >
      <div className="flex items-center gap-2 mb-4">
        <Info size={20} className="text-purple-600 dark:text-purple-400" />
        <h3 className="font-bold text-purple-900 dark:text-slate-200">পয়েন্ট ডিস্ট্রিবিউশন গাইড</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-2 transition-colors duration-300">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <PlusCircle size={18} />
            <span className="font-bold text-sm">দাতা যোগ</span>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-500">২০ <span className="text-xs font-medium text-gray-500 dark:text-slate-500">পয়েন্ট</span></p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500">প্রতিটি নতুন রক্তদাতা যোগ করার জন্য</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-2 transition-colors duration-300">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Heart size={18} />
            <span className="font-bold text-sm">নিজের দাতা</span>
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-500">১০ <span className="text-xs font-medium text-gray-500 dark:text-slate-500">পয়েন্ট</span></p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500">নিজের যোগ করা দাতা রক্ত দিলে</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-2 transition-colors duration-300">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <TrendingUp size={18} />
            <span className="font-bold text-sm">অন্যের দাতা</span>
          </div>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-500">৫ <span className="text-xs font-medium text-gray-500 dark:text-slate-500">পয়েন্ট</span></p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500">অন্যের যোগ করা দাতা রক্ত দিলে</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-2 transition-colors duration-300">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <PhoneCall size={18} />
            <span className="font-bold text-sm">কনভিন্সিং</span>
          </div>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-500">৫ <span className="text-xs font-medium text-gray-500 dark:text-slate-500">পয়েন্ট</span></p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500">কল করে দাতা রাজি করালে</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col z-[70] overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
      >
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 text-white flex justify-between items-center shadow-lg relative overflow-hidden transition-colors duration-300">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="flex items-center gap-4 relative z-10">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20"
            >
              <Trophy size={28} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">লিডারবোর্ড</h2>
              <p className="text-purple-200 dark:text-slate-400 text-xs font-medium uppercase tracking-widest opacity-80">স্বেচ্ছাসেবকদের সম্মাননা তালিকা</p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            {canSeeBreakdown && (
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 rounded-full transition-all ${showInfo ? 'bg-white text-purple-900 dark:bg-slate-800 dark:text-slate-200' : 'bg-white/10 hover:bg-white/20'}`}
                title="পয়েন্ট ডিস্ট্রিবিউশন ডিটেইলস"
              >
                <Info size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 hover:rotate-90">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
          
          {/* Statistics Bar */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-emerald-100 dark:border-slate-700 flex items-center gap-5 transition-colors duration-300"
            >
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest mb-1">মোট স্বেচ্ছাসেবক</p>
                <p className="text-3xl font-black text-gray-800 dark:text-slate-200 tracking-tight">{activeUsers.length}</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-purple-100 dark:border-slate-700 flex items-center gap-5 transition-colors duration-300"
            >
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest mb-1">মোট অর্জিত পয়েন্ট</p>
                <p className="text-3xl font-black text-gray-800 dark:text-slate-200 tracking-tight">{totalPoints}</p>
              </div>
            </motion.div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="animate-spin text-purple-600 dark:text-purple-400 mb-4" size={48} />
                <p className="text-purple-800 dark:text-slate-300 font-bold animate-pulse">লিডারবোর্ড লোড হচ্ছে...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Top 3 Podium Visualization */}
                {topThree.length > 0 && (
                  <div className="flex justify-center items-end gap-2 md:gap-8 pt-10 pb-6">
                    {/* 2nd Place */}
                    {topThree[1] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center"
                      >
                        <div className="relative mb-4">
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-200 dark:bg-slate-700 rounded-full border-4 border-slate-300 dark:border-slate-600 flex items-center justify-center text-2xl font-black text-slate-500 dark:text-slate-400 shadow-inner overflow-hidden">
                            {topThree[1].displayName.charAt(0)}
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-slate-400 text-white p-1.5 rounded-full border-2 border-white dark:border-slate-800 shadow-md">
                            <Medal size={16} />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 text-center w-28 md:w-36 transition-colors duration-300">
                          <p className="font-bold text-xs md:text-sm truncate dark:text-slate-200">{topThree[1].displayName}</p>
                          <p className="text-slate-600 dark:text-slate-400 font-black text-sm md:text-base">{topThree[1].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5 text-left">
                              <div className="flex justify-between text-[8px] font-bold text-blue-600 dark:text-blue-400">
                                <span>দাতা যোগ:</span>
                                <span>+{topThree[1].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>নিজের দাতা:</span>
                                <span>+{topThree[1].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-orange-600 dark:text-orange-400">
                                <span>অন্যের দাতা:</span>
                                <span>+{topThree[1].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-purple-600 dark:text-purple-400">
                                <span>কনভিন্সিং:</span>
                                <span>+{topThree[1].pointsFromConvinced || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="h-16 md:h-20 w-16 md:w-20 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-t-xl mt-2 flex items-center justify-center">
                          <span className="text-2xl font-black text-slate-400 dark:text-slate-500">2</span>
                        </div>
                      </motion.div>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center -mt-8"
                      >
                        <div className="relative mb-4">
                          <motion.div 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                            className="w-20 h-20 md:w-28 md:h-28 bg-yellow-100 dark:bg-yellow-900/20 rounded-full border-4 border-yellow-400 flex items-center justify-center text-3xl font-black text-yellow-600 dark:text-yellow-400 shadow-inner overflow-hidden"
                          >
                            {topThree[0].displayName.charAt(0)}
                          </motion.div>
                          <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white p-2 rounded-full border-2 border-white dark:border-slate-800 shadow-lg">
                            <Trophy size={20} />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-yellow-100 dark:border-yellow-900/30 text-center w-32 md:w-44 ring-2 ring-yellow-400/20 transition-colors duration-300">
                          <p className="font-black text-sm md:text-base truncate text-yellow-900 dark:text-yellow-400">{topThree[0].displayName}</p>
                          <p className="text-yellow-600 dark:text-yellow-500 font-black text-lg md:text-xl">{topThree[0].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-2 pt-2 border-t border-yellow-100 dark:border-yellow-900/30 space-y-1 text-left">
                              <div className="flex justify-between text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <span>দাতা যোগ:</span>
                                <span>+{topThree[0].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>নিজের দাতা:</span>
                                <span>+{topThree[0].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                <span>অন্যের দাতা:</span>
                                <span>+{topThree[0].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                <span>কনভিন্সিং:</span>
                                <span>+{topThree[0].pointsFromConvinced || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="h-24 md:h-32 w-20 md:w-28 bg-gradient-to-t from-yellow-400 to-yellow-200 dark:from-yellow-600 dark:to-yellow-800 rounded-t-2xl mt-2 flex items-center justify-center shadow-lg">
                          <span className="text-4xl font-black text-yellow-600/50 dark:text-yellow-400/30">1</span>
                        </div>
                      </motion.div>
                    )}

                    {/* 3rd Place */}
                    {topThree[2] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-col items-center"
                      >
                        <div className="relative mb-4">
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full border-4 border-orange-300 dark:border-orange-600 flex items-center justify-center text-2xl font-black text-orange-600 dark:text-orange-400 shadow-inner overflow-hidden">
                            {topThree[2].displayName.charAt(0)}
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-1.5 rounded-full border-2 border-white dark:border-slate-800 shadow-md">
                            <Award size={16} />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-md border border-orange-100 dark:border-slate-700 text-center w-28 md:w-36 transition-colors duration-300">
                          <p className="font-bold text-xs md:text-sm truncate dark:text-slate-200">{topThree[2].displayName}</p>
                          <p className="text-orange-600 dark:text-orange-400 font-black text-sm md:text-base">{topThree[2].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-2 pt-2 border-t border-orange-100 dark:border-slate-700 space-y-0.5 text-left">
                              <div className="flex justify-between text-[8px] font-bold text-blue-600 dark:text-blue-400">
                                <span>দাতা যোগ:</span>
                                <span>+{topThree[2].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>নিজের দাতা:</span>
                                <span>+{topThree[2].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-orange-600 dark:text-orange-400">
                                <span>অন্যের দাতা:</span>
                                <span>+{topThree[2].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-purple-600 dark:text-purple-400">
                                <span>কনভিন্সিং:</span>
                                <span>+{topThree[2].pointsFromConvinced || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="h-12 md:h-16 w-16 md:w-20 bg-gradient-to-t from-orange-200 to-orange-100 dark:from-orange-700 dark:to-orange-800 rounded-t-xl mt-2 flex items-center justify-center">
                          <span className="text-2xl font-black text-orange-400 dark:text-orange-500">3</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Main Leaderboard List */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-xl overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
                      <tr className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        <th scope="col" className="p-5 text-center w-20">র‍্যাংক</th>
                        <th scope="col" className="p-5">স্বেচ্ছাসেবক</th>
                        <th scope="col" className="p-5 text-center hidden md:table-cell">দাতা যোগ</th>
                        {canSeeBreakdown && (
                          <th scope="col" className="p-5 text-left hidden lg:table-cell">পয়েন্ট ব্রেকডাউন</th>
                        )}
                        <th scope="col" className="p-5 text-center">মোট পয়েন্ট</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                      {activeUsers.map((user, index) => {
                        const rank = index + 1;
                        const isTopThree = rank <= 3;
                        
                        return (
                          <motion.tr 
                            key={user.uid}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`group transition-all hover:bg-slate-50/80 dark:hover:bg-slate-700/50 ${isTopThree ? 'bg-white dark:bg-slate-800' : index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-900/50'}`}
                          >
                            <td className="p-5 align-middle text-center">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto font-black text-sm transition-transform group-hover:scale-110 ${
                                rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 shadow-sm' :
                                rank === 2 ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm' :
                                rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-500 shadow-sm' :
                                'text-slate-400 dark:text-slate-600'
                              }`}>
                                {rank}
                              </div>
                            </td>
                            <td className="p-5 align-middle">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                                  rank === 1 ? 'bg-yellow-500' :
                                  rank === 2 ? 'bg-slate-400' :
                                  rank === 3 ? 'bg-orange-500' :
                                  'bg-indigo-500'
                                }`}>
                                  {user.displayName.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm md:text-base group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{user.displayName}</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{user.email}</div>
                                  {canSeeBreakdown && (
                                    <div className="flex flex-col gap-0.5 mt-2 lg:hidden">
                                      <div className="flex justify-between w-32 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                        <span>দাতা যোগ:</span>
                                        <span>+{user.pointsFromAdding || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-32 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                                        <span>নিজের দাতা:</span>
                                        <span>+{user.pointsFromOwnDonors || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-32 text-[8px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                                        <span>অন্যের দাতা:</span>
                                        <span>+{user.pointsFromOtherDonors || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-32 text-[8px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                                        <span>কনভিন্সিং:</span>
                                        <span>+{user.pointsFromConvinced || 0}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-5 align-middle text-center hidden md:table-cell">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                {user.donorsAdded || 0}
                              </span>
                            </td>
                            {canSeeBreakdown && (
                              <td className="p-5 align-middle hidden lg:table-cell">
                                <div className="flex flex-col gap-1 text-[10px] w-40">
                                  <div className="flex justify-between items-center px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/30">
                                    <span>দাতা যোগ:</span>
                                    <span className="font-black">+{user.pointsFromAdding || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-100 dark:border-emerald-900/30">
                                    <span>নিজের দাতা:</span>
                                    <span className="font-black">+{user.pointsFromOwnDonors || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded border border-orange-100 dark:border-orange-900/30">
                                    <span>অন্যের দাতা:</span>
                                    <span className="font-black">+{user.pointsFromOtherDonors || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30">
                                    <span>কনভিন্সিং:</span>
                                    <span className="font-black">+{user.pointsFromConvinced || 0}</span>
                                  </div>
                                </div>
                              </td>
                            )}
                            <td className="p-5 align-middle text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-lg font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                  {user.points || 0}
                                </span>
                                <div className="h-1 w-full bg-purple-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, ((user.points || 0) / (topThree[0]?.points || 1)) * 100)}%` }}
                                    className="h-full bg-purple-600 dark:bg-purple-500"
                                  />
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                      {activeUsers.length === 0 && (
                        <tr>
                          <td colSpan={canSeeBreakdown ? 5 : 4} className="p-20 text-center">
                            <div className="bg-slate-50 dark:bg-slate-900/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                              <Trophy size={48} className="text-slate-200 dark:text-slate-700" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">লিডারবোর্ডে এখনো কেউ নেই</h3>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">রক্তদাতা যোগ করে বা রক্তদান নিশ্চিত করে পয়েন্ট অর্জন করুন!</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <AnimatePresence>
                  {canSeeBreakdown && showInfo && (
                    <div className="mt-8 pb-8">
                      <PointDistribution />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
