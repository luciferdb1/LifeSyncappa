import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendEmailVerification, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile } from '../types';
import { User, Shield, Edit, Check, X, Loader2, Award, UserPlus, Mail, Lock, Trash2, AlertTriangle, Search, Filter, MoreVertical, ShieldCheck, UserCheck, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserProfileModal from './UserProfileModal';
import { getRoleBadgeDefinition } from '../lib/roleUtils';

interface UserManagementProps {
  onClose: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user'>('all');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  
  // Add User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        userList.push(doc.data() as UserProfile);
      });
      setUsers(userList);
      setLoading(false);
    }, (error: any) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } else {
        console.error("Firestore permission denied for users list in UserManagement:", error.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');

    if (!newPhone || newPhone.length !== 11 || !newPhone.startsWith('01')) {
      setAddError('Please enter a valid 11-digit phone number starting with 01.');
      setAddLoading(false);
      return;
    }

    try {
      const secondaryAppName = `SecondaryApp_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, 'Shishir');
      const newUser = userCredential.user;

      await sendEmailVerification(newUser);

      try {
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          displayName: newName,
          phone: newPhone,
          role: 'volunteer',
          points: 0
        });
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.CREATE, `users/${newUser.uid}`);
        return;
      }

      await signOut(secondaryAuth);
      
      setAddSuccess(`Volunteer '${newName}' added successfully. Default password: Shishir`);
      setNewEmail('');
      setNewName('');
      setNewPhone('');
      setTimeout(() => setShowAddUser(false), 3000);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setAddError('This email is already registered. If they were deleted earlier, they just need to log in to the app themselves. Once they log in, they will reappear in this list and you can change their role.');
      } else {
        setAddError(error.message || 'Error adding user');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user') => {
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (uid: string, email?: string) => {
    setDeletingId(uid);
    try {
      // 1. Try to delete the Firebase Auth user if the password is the default 'Shishir'
      if (email) {
        try {
          const secondaryAppName = `DeleteApp_${Date.now()}`;
          const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);
          
          try {
            const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, 'Shishir');
            if (userCredential.user) {
               await deleteUser(userCredential.user);
            }
          } catch (signInOrDeleteError) {
             console.log("Could not delete from Auth (non-default password or user already deleted)");
          } finally {
            await signOut(secondaryAuth);
          }
        } catch (setupError) {
          console.error("Secondary app setup failed:", setupError);
        }
      }

      await deleteDoc(doc(db, 'users', uid));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.displayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                         (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex-1 flex flex-col min-h-0"
      >
        {/* Header - Modern Glassmorphism */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white font-outfit leading-none">
                  User <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">Management</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Access Control</span>
                  <div className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-widest">{users.length} Total Accounts</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setShowAddUser(!showAddUser)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest shadow-lg ${
                  showAddUser 
                  ? 'bg-slate-900 dark:bg-slate-700 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                }`}
              >
                {showAddUser ? <X size={16} /> : <UserPlus size={16} />}
                {showAddUser ? 'Cancel' : 'Add Volunteer'}
              </button>
              <button 
                onClick={onClose} 
                className="p-3 bg-white/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-all border border-white dark:border-slate-700 shadow-md backdrop-blur-md"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        {!showAddUser && (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 p-4 shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input 
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {(['all', 'admin', 'president', 'secretary', 'media', 'volunteer', 'user'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                      roleFilter === role 
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {role === 'all' ? 'All Users' : 
                     role === 'admin' ? 'Admins' : 
                     role === 'president' ? 'President' : 
                     role === 'secretary' ? 'Secretary Team' : 
                     role === 'media' ? 'Media Team' : 
                     role === 'volunteer' ? 'Volunteers' : 
                     'Members'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 pb-24">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Overview */}
            {!showAddUser && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white dark:border-slate-800 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Users</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{users.length}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white dark:border-slate-800 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Admins</p>
                  <p className="text-2xl font-black text-emerald-600 tracking-tighter">{users.filter(u => u.role === 'admin').length}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white dark:border-slate-800 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Volunteers</p>
                  <p className="text-2xl font-black text-blue-600 tracking-tighter">{users.filter(u => u.role === 'volunteer' || u.role === 'editor' || u.role === 'media' || u.role === 'president' || u.role === 'secretary').length}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white dark:border-slate-800 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Members</p>
                  <p className="text-2xl font-black text-slate-500 tracking-tighter">{users.filter(u => u.role === 'user').length}</p>
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {showAddUser ? (
                <motion.div 
                  key="add-user-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-xl mx-auto"
                >
                  <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
                    
                    <div className="text-center mb-10 relative z-10">
                      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4 shadow-xl shadow-emerald-500/10">
                        <UserPlus size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">Add New Editor</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-widest">Create a new administrative account</p>
                    </div>

                    <form onSubmit={handleAddUser} className="space-y-6 relative z-10">
                      {addError && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-3">
                          <AlertTriangle size={18} />
                          {addError}
                        </div>
                      )}
                      {addSuccess && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl text-xs font-bold border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
                          <Check size={18} />
                          {addSuccess}
                        </div>
                      )}

                      <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-emerald-500 transition-colors">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20} />
                          <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-emerald-500 transition-colors">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20} />
                          <input
                            type="email"
                            required
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-emerald-500 transition-colors">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20} />
                          <input
                            type="tel"
                            required
                            maxLength={11}
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="01XXXXXXXXX"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl">
                        <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400 mb-1">
                          <Lock size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Security Note</span>
                        </div>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold">
                          The default password for new accounts is <span className="text-amber-800 dark:text-amber-300">Shishir</span>. 
                          Users will be prompted to verify their email upon first login.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={addLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                      >
                        {addLoading ? <Loader2 className="animate-spin" size={20} /> : (
                          <>
                            <UserCheck size={20} />
                            Create Editor Account
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="user-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {loading ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-10">
                      <Loader2 className="animate-spin text-emerald-600 mb-4" size={32} />
                      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Loading Users...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4">
                        <Search size={24} />
                      </div>
                      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No users found matching your criteria</p>
                    </div>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <motion.div
                        key={user.uid}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors" />
                        
                        <div className="flex items-start justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-3">
                            {user.photoUrl ? (
                              <img src={user.photoUrl} alt={user.displayName} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/20 group-hover:text-emerald-600 transition-all duration-300">
                                <User size={20} />
                              </div>
                            )}
                            <div>
                              <button onClick={() => setSelectedProfile(user)} className="font-black text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-[140px] text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                {user.displayName || 'Unknown User'}
                              </button>
                               {(() => {
                                 const roleBadge = getRoleBadgeDefinition(user.role || 'user');
                                 return (
                                   <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-[8px] font-black uppercase tracking-widest rounded`}>
                                     <roleBadge.icon size={8} />
                                     {roleBadge.label}
                                   </div>
                                 );
                               })()}
                            </div>
                          </div>
                          {user.email !== 'debashisbarmandb1@gmail.com' && (
                            <div className="relative">
                              <button 
                                onClick={() => setShowDeleteConfirm(user.uid)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                              
                              <AnimatePresence>
                                {showDeleteConfirm === user.uid && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    className="absolute right-0 top-full mt-2 w-48 p-3 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-xl shadow-xl z-20"
                                  >
                                    <div className="flex items-start gap-2 text-red-600 mb-3">
                                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                      <p className="text-[9px] font-black uppercase tracking-tight leading-tight">Delete user?</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleDeleteUser(user.uid, user.email)}
                                        disabled={deletingId === user.uid}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                      >
                                        {deletingId === user.uid ? <Loader2 size={10} className="animate-spin mx-auto" /> : 'Yes'}
                                      </button>
                                      <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                      >
                                        No
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-4 relative z-10">
                          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-full border border-amber-100 dark:border-amber-900/30">
                            <Award size={10} className="text-amber-600" />
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-400">{user.points || 0} pts</span>
                          </div>
                          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 relative z-10 w-full mt-2 lg:mt-0">
                          {(['admin', 'president', 'secretary', 'media', 'volunteer', 'user'] as const).map((role) => (
                            <button
                              key={role}
                              disabled={updatingId === user.uid || user.role === role || (user.role === 'editor' && role === 'volunteer')}
                              onClick={() => handleRoleChange(user.uid, role)}
                              className={`py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border shrink-0 ${
                                user.role === role || (user.role === 'editor' && role === 'volunteer')
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/10' 
                                  : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-500/20'
                              } disabled:opacity-50 flex items-center justify-center`}
                            >
                              {updatingId === user.uid && user.role !== role ? (
                                <Loader2 className="animate-spin" size={10} />
                              ) : (
                                role === 'admin' ? 'Admin' : 
                                role === 'president' ? 'President' :
                                role === 'secretary' ? 'Secretary' :
                                role === 'media' ? 'Media' :
                                role === 'volunteer' ? 'Volunteer' :
                                'User'
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      
      {/* User Profile Popup Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <UserProfileModal user={selectedProfile} onClose={() => setSelectedProfile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
