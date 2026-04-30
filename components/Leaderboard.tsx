import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { UserProfile } from '../types';
import { Trophy, Medal, Award, X, Loader2, Users, Info, TrendingUp, Heart, PlusCircle, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import UserProfileModal from './UserProfileModal';
import { getRoleBadgeDefinition } from '../lib/roleUtils';

interface LeaderboardProps {
  onClose: () => void;
  userRole: 'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user' | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, userRole }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const canSeeBreakdown = userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' || userRole === 'volunteer' || userRole === 'editor';
  const canResetPoints = userRole === 'admin' || userRole === 'president' || userRole === 'secretary';

  const handleResetPoints = async () => {
    setResetError('');
    setIsResetting(true);
    
    if (!auth.currentUser || !auth.currentUser.email) {
      setResetError("Current user not authenticated properly.");
      setIsResetting(false);
      return;
    }
    
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, resetPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      if (!auth.currentUser.emailVerified) {
         setResetError("Email must be verified to reset points.");
         setIsResetting(false);
         return;
      }
      
      const usersQuery = query(collection(db, 'users'));
      const snapshot = await getDocs(usersQuery);
      
      const promises = [];
      snapshot.forEach(docSnap => {
         promises.push(updateDoc(doc(db, 'users', docSnap.id), {
           points: 0,
           pointsFromAdding: 0,
           pointsFromOwnDonors: 0,
           pointsFromOtherDonors: 0,
           pointsFromConvinced: 0
         }));
      });
      await Promise.all(promises);
      
      setShowResetModal(false);
      setResetPassword('');
      alert("Success! Points have been reset for all users.");
      
    } catch (e: any) {
      if (e.code === 'auth/invalid-credential') {
        setResetError("Incorrect password. Please try again.");
      } else {
        setResetError(e.message || "Invalid password or an error occurred.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    // Query users, order by points descending
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        // Only include volunteers as per the new point system logic
        if (data.role === 'volunteer') {
          userList.push(data);
        }
      });
      setUsers(userList);
      setLoading(false);
    }, (error: any) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } else {
        console.error("Firestore permission denied for users list in leaderboard:", error.message);
      }
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
      className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 p-4 sm:p-6 rounded-2xl border border-purple-100 dark:border-slate-700 mb-4 sm:mb-6 shadow-sm transition-colors duration-300"
    >
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Info size={18} className="text-purple-600 dark:text-purple-400 sm:w-5 sm:h-5" />
        <h3 className="font-bold text-sm sm:text-base text-purple-900 dark:text-slate-200">Point Distribution Guide</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-1.5 sm:gap-2 transition-colors duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 dark:text-emerald-400">
            <PlusCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="font-bold text-xs sm:text-sm">Add Donor</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-500">20 <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-500">Points</span></p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-slate-500 leading-tight">For adding each new blood donor</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-1.5 sm:gap-2 transition-colors duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 text-blue-600 dark:text-blue-400">
            <Heart size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="font-bold text-xs sm:text-sm">Own Donor</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-500">10 <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-500">Points</span></p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-slate-500 leading-tight">When own added donor donates</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-1.5 sm:gap-2 transition-colors duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 text-orange-600 dark:text-orange-400">
            <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="font-bold text-xs sm:text-sm">Other's Donor</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-orange-700 dark:text-orange-500">5 <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-500">Points</span></p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-slate-500 leading-tight">When other's added donor donates</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow-sm border border-purple-100 dark:border-slate-700 flex flex-col gap-1.5 sm:gap-2 transition-colors duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 text-purple-600 dark:text-purple-400">
            <PhoneCall size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="font-bold text-xs sm:text-sm">Convincing</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-500">5 <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-500">Points</span></p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-slate-500 leading-tight">For convincing donor via call</p>
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
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 text-white flex justify-between items-center shadow-lg relative overflow-hidden transition-colors duration-300">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="bg-white/10 p-2 sm:p-3 rounded-2xl backdrop-blur-md border border-white/20"
            >
              <Trophy size={24} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] sm:w-7 sm:h-7" />
            </motion.div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">Leaderboard</h2>
              <p className="text-purple-200 dark:text-slate-400 text-[9px] sm:text-xs font-medium uppercase tracking-wider opacity-80">Volunteer Honor Roll</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 relative z-10">
            {canResetPoints && (
              <button 
                onClick={() => setShowResetModal(true)}
                className="p-1.5 sm:p-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white rounded-full transition-all flex items-center justify-center"
                title="Reset Points for All Volunteers"
              >
                <X size={18} className="sm:w-5 sm:h-5 mr-1" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:block pr-1">Reset</span>
              </button>
            )}
            {canSeeBreakdown && (
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className={`p-1.5 sm:p-2 rounded-full transition-all ${showInfo ? 'bg-white text-purple-900 dark:bg-slate-800 dark:text-slate-200' : 'bg-white/10 hover:bg-white/20'}`}
                title="Point Distribution Details"
              >
                <Info size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 hover:rotate-90">
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
          
          {/* Statistics Bar */}
          <div className="p-4 sm:p-6 grid grid-cols-2 gap-3 sm:gap-6">
            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-slate-800 p-3 sm:p-5 rounded-2xl shadow-sm border border-emerald-100 dark:border-slate-700 flex items-center gap-3 sm:gap-5 transition-colors duration-300"
            >
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 sm:p-4 rounded-xl sm:rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                <Users size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-wider mb-0.5 sm:mb-1">Total Volunteers</p>
                <p className="text-xl sm:text-3xl font-black text-gray-800 dark:text-slate-200 tracking-tight">{activeUsers.length}</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-slate-800 p-3 sm:p-5 rounded-2xl shadow-sm border border-purple-100 dark:border-slate-700 flex items-center gap-3 sm:gap-5 transition-colors duration-300"
            >
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2 sm:p-4 rounded-xl sm:rounded-2xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                <Trophy size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-wider mb-0.5 sm:mb-1">Total Points Earned</p>
                <p className="text-xl sm:text-3xl font-black text-gray-800 dark:text-slate-200 tracking-tight">{totalPoints}</p>
              </div>
            </motion.div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64">
                <Loader2 className="animate-spin text-purple-600 dark:text-purple-400 mb-3 sm:mb-4 sm:w-12 sm:h-12" size={32} />
                <p className="text-sm sm:text-base text-purple-800 dark:text-slate-300 font-bold animate-pulse">Loading Leaderboard...</p>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {/* Top 3 Podium Visualization */}
                {topThree.length > 0 && (
                  <div className="flex justify-center items-end gap-2 sm:gap-4 md:gap-8 pt-6 sm:pt-10 pb-4 sm:pb-6">
                    {/* 2nd Place */}
                    {topThree[1] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center"
                      >
                        <div className="relative mb-2 sm:mb-4">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-slate-200 dark:bg-slate-700 rounded-full border-[3px] sm:border-4 border-slate-300 dark:border-slate-600 flex items-center justify-center text-lg sm:text-2xl font-black text-slate-500 dark:text-slate-400 shadow-inner overflow-hidden">
                            {topThree[1].displayName.charAt(0)}
                          </div>
                          <div className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 bg-slate-400 text-white p-1 sm:p-1.5 rounded-full border-2 border-white dark:border-slate-800 shadow-md">
                            <Medal size={12} className="sm:w-4 sm:h-4" />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 text-center w-24 sm:w-28 md:w-36 transition-colors duration-300">
                          <button onClick={() => setSelectedProfile(topThree[1])} className="font-bold text-[10px] sm:text-xs md:text-sm truncate dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 block w-full text-center">{topThree[1].displayName}</button>
                          {(() => {
                              const roleBadge = getRoleBadgeDefinition(topThree[1].role || 'user');
                              return (
                                  <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[8px] font-black uppercase tracking-widest rounded`}>
                                      <roleBadge.icon size={8} />
                                      {roleBadge.label}
                                  </div>
                              );
                          })()}
                          <p className="text-slate-600 dark:text-slate-400 font-black text-xs sm:text-sm md:text-base mt-0.5">{topThree[1].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5 text-left">
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-blue-600 dark:text-blue-400">
                                <span>Add Donor:</span>
                                <span>+{topThree[1].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Own Donor:</span>
                                <span>+{topThree[1].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-orange-600 dark:text-orange-400">
                                <span>Other's Donor:</span>
                                <span>+{topThree[1].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-purple-600 dark:text-purple-400">
                                <span>Convincing:</span>
                                <span>+{topThree[1].pointsFromConvinced || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="h-12 sm:h-16 md:h-20 w-12 sm:w-16 md:w-20 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-t-xl mt-1.5 sm:mt-2 flex items-center justify-center">
                          <span className="text-xl sm:text-2xl font-black text-slate-400 dark:text-slate-500">2</span>
                        </div>
                      </motion.div>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center -mt-4 sm:-mt-8"
                      >
                        <div className="relative mb-2 sm:mb-4">
                          <motion.div 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                            className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 bg-yellow-100 dark:bg-yellow-900/20 rounded-full border-[3px] sm:border-4 border-yellow-400 flex items-center justify-center text-2xl sm:text-3xl font-black text-yellow-600 dark:text-yellow-400 shadow-inner overflow-hidden"
                          >
                            {topThree[0].displayName.charAt(0)}
                          </motion.div>
                          <div className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 bg-yellow-500 text-white p-1.5 sm:p-2 rounded-full border-2 border-white dark:border-slate-800 shadow-lg">
                            <Trophy size={16} className="sm:w-5 sm:h-5" />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-yellow-100 dark:border-yellow-900/30 text-center w-28 sm:w-32 md:w-44 ring-2 ring-yellow-400/20 transition-colors duration-300">
                          <button onClick={() => setSelectedProfile(topThree[0])} className="font-black text-xs sm:text-sm md:text-base truncate text-yellow-900 dark:text-yellow-400 hover:text-purple-600 block w-full text-center">{topThree[0].displayName}</button>
                          {(() => {
                              const roleBadge = getRoleBadgeDefinition(topThree[0].role || 'user');
                              return (
                                  <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[8px] font-black uppercase tracking-widest rounded`}>
                                      <roleBadge.icon size={8} />
                                      {roleBadge.label}
                                  </div>
                              );
                          })()}
                          <p className="text-yellow-600 dark:text-yellow-500 font-black text-sm sm:text-lg md:text-xl mt-0.5">{topThree[0].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-yellow-100 dark:border-yellow-900/30 space-y-0.5 sm:space-y-1 text-left">
                              <div className="flex justify-between text-[8px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <span>Add Donor:</span>
                                <span>+{topThree[0].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Own Donor:</span>
                                <span>+{topThree[0].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] sm:text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                <span>Other's Donor:</span>
                                <span>+{topThree[0].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                <span>Convincing:</span>
                                <span>+{topThree[0].pointsFromConvinced || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="h-16 sm:h-24 md:h-32 w-16 sm:w-20 md:w-28 bg-gradient-to-t from-yellow-400 to-yellow-200 dark:from-yellow-600 dark:to-yellow-800 rounded-t-xl sm:rounded-t-2xl mt-1.5 sm:mt-2 flex items-center justify-center shadow-lg">
                          <span className="text-2xl sm:text-4xl font-black text-yellow-600/50 dark:text-yellow-400/30">1</span>
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
                        <div className="relative mb-2 sm:mb-4">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full border-[3px] sm:border-4 border-orange-300 dark:border-orange-600 flex items-center justify-center text-lg sm:text-2xl font-black text-orange-600 dark:text-orange-400 shadow-inner overflow-hidden">
                            {topThree[2].displayName.charAt(0)}
                          </div>
                          <div className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 bg-orange-500 text-white p-1 sm:p-1.5 rounded-full border-2 border-white dark:border-slate-800 shadow-md">
                            <Award size={12} className="sm:w-4 sm:h-4" />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-xl shadow-md border border-orange-100 dark:border-slate-700 text-center w-24 sm:w-28 md:w-36 transition-colors duration-300">
                          <button onClick={() => setSelectedProfile(topThree[2])} className="font-bold text-[10px] sm:text-xs md:text-sm truncate dark:text-slate-200 hover:text-purple-600 block w-full text-center">{topThree[2].displayName}</button>
                          {(() => {
                              const roleBadge = getRoleBadgeDefinition(topThree[2].role || 'user');
                              return (
                                  <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[8px] font-black uppercase tracking-widest rounded`}>
                                      <roleBadge.icon size={8} />
                                      {roleBadge.label}
                                  </div>
                              );
                          })()}
                          <p className="text-orange-600 dark:text-orange-400 font-black text-xs sm:text-sm md:text-base mt-0.5">{topThree[2].points}</p>
                          {canSeeBreakdown && (
                            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-orange-100 dark:border-slate-700 space-y-0.5 text-left">
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-blue-600 dark:text-blue-400">
                                <span>Add Donor:</span>
                                <span>+{topThree[2].pointsFromAdding || 0}</span>
                              </div>
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>Own Donor:</span>
                                <span>+{topThree[2].pointsFromOwnDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[7px] sm:text-[8px] font-bold text-orange-600 dark:text-orange-400">
                                <span>Other's Donor:</span>
                                <span>+{topThree[2].pointsFromOtherDonors || 0}</span>
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-purple-600 dark:text-purple-400">
                                <span>Convincing:</span>
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
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-lg overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
                      <tr className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-[0.15em]">
                        <th scope="col" className="p-3 text-center w-16">Rank</th>
                        <th scope="col" className="p-3">Volunteer</th>
                        <th scope="col" className="p-3 text-center hidden md:table-cell">Add Donor</th>
                        {canSeeBreakdown && (
                          <th scope="col" className="p-3 text-left hidden lg:table-cell">Point Breakdown</th>
                        )}
                        <th scope="col" className="p-3 text-center">Total Points</th>
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
                            <td className="p-3 align-middle text-center">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto font-black text-xs transition-transform group-hover:scale-110 ${
                                rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 shadow-sm' :
                                rank === 2 ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm' :
                                rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-500 shadow-sm' :
                                'text-slate-400 dark:text-slate-600'
                              }`}>
                                {rank}
                              </div>
                            </td>
                            <td className="p-3 align-middle">
                              <div className="flex items-center gap-2">
                                {user.photoUrl ? (
                                  <img src={user.photoUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover shadow-sm" />
                                ) : (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm text-xs ${
                                    rank === 1 ? 'bg-yellow-500' :
                                    rank === 2 ? 'bg-slate-400' :
                                    rank === 3 ? 'bg-orange-500' :
                                    'bg-indigo-500'
                                  }`}>
                                    {user.displayName.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <button onClick={() => setSelectedProfile(user)} className="text-left font-bold text-slate-800 dark:text-slate-200 text-sm hover:text-purple-700 dark:hover:text-purple-400 transition-colors">{user.displayName || 'Unknown User'}</button>
                                  {(() => {
                                      const roleBadge = getRoleBadgeDefinition(user.role || 'user');
                                      return (
                                          <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[8px] font-black uppercase tracking-widest rounded`}>
                                              <roleBadge.icon size={8} />
                                              {roleBadge.label}
                                          </div>
                                      );
                                  })()}
                                  {canSeeBreakdown && (
                                    <div className="flex flex-col gap-0.5 mt-1 lg:hidden">
                                      <div className="flex justify-between w-28 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                        <span>Add Donor:</span>
                                        <span>+{user.pointsFromAdding || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-28 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                                        <span>Own Donor:</span>
                                        <span>+{user.pointsFromOwnDonors || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-28 text-[8px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                                        <span>Other's Donor:</span>
                                        <span>+{user.pointsFromOtherDonors || 0}</span>
                                      </div>
                                      <div className="flex justify-between w-28 text-[8px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                                        <span>Convincing:</span>
                                        <span>+{user.pointsFromConvinced || 0}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 align-middle text-center hidden md:table-cell">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                {user.donorsAdded || 0}
                              </span>
                            </td>
                            {canSeeBreakdown && (
                              <td className="p-3 align-middle hidden lg:table-cell">
                                <div className="flex flex-col gap-0.5 text-[9px] w-32">
                                  <div className="flex justify-between items-center px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/30">
                                    <span>Add Donor:</span>
                                    <span className="font-black">+{user.pointsFromAdding || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-100 dark:border-emerald-900/30">
                                    <span>Own Donor:</span>
                                    <span className="font-black">+{user.pointsFromOwnDonors || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded border border-orange-100 dark:border-orange-900/30">
                                    <span>Other's Donor:</span>
                                    <span className="font-black">+{user.pointsFromOtherDonors || 0}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30">
                                    <span>Convincing:</span>
                                    <span className="font-black">+{user.pointsFromConvinced || 0}</span>
                                  </div>
                                </div>
                              </td>
                            )}
                            <td className="p-3 align-middle text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                  {user.points || 0}
                                </span>
                                <div className="h-1 w-full bg-purple-100 dark:bg-slate-700 rounded-full mt-0.5 overflow-hidden">
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
                          <td colSpan={canSeeBreakdown ? 5 : 4} className="p-10 text-center">
                            <div className="bg-slate-50 dark:bg-slate-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Trophy size={32} className="text-slate-200 dark:text-slate-700" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No one on the leaderboard yet</h3>
                            <p className="text-slate-400 dark:text-slate-500 text-xs">Earn points by adding blood donors or confirming donations!</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <AnimatePresence>
                  {canSeeBreakdown && showInfo && (
                    <div className="mt-6 pb-6">
                      <PointDistribution />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* User Profile Modal */}
      {selectedProfile && (
        <UserProfileModal user={selectedProfile} onClose={() => setSelectedProfile(null)} />
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2 mt-1">Reset All Points</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 font-medium">
                This will reset points to zero for all volunteers. Please enter your password to confirm.
            </p>
            {resetError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold p-3 rounded-lg mb-4 border border-red-100 dark:border-red-900/30">
                {resetError}
              </div>
            )}
            <input 
               type="password" 
               placeholder="Confirm Password" 
               value={resetPassword}
               onChange={(e) => setResetPassword(e.target.value)}
               className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-medium mb-4 focus:ring-2 focus:ring-red-500 focus:outline-none dark:text-white"
            />
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => {
                   setShowResetModal(false);
                   setResetPassword('');
                   setResetError('');
                }} 
                className="flex-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetPoints} 
                disabled={isResetting || !resetPassword}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isResetting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
