import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, setDoc } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile } from '../types';
import { User, Shield, Edit, Check, X, Loader2, Award, UserPlus, Mail, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { deleteDoc } from 'firebase/firestore';

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
  
  // Add User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');

    try {
      // Initialize a secondary app to create the user without logging out the current admin
      const secondaryAppName = `SecondaryApp_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // Create the user with default password 'Shishir'
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, 'Shishir');
      const newUser = userCredential.user;

      // Send verification email
      await sendEmailVerification(newUser);

      // Create user profile in Firestore using the main db instance
      try {
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          displayName: newName,
          role: 'editor', // Default to editor as requested
          points: 0
        });
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.CREATE, `users/${newUser.uid}`);
        return;
      }

      // Sign out from the secondary app and clean up
      await signOut(secondaryAuth);
      
      setAddSuccess(`এডিটর '${newName}' সফলভাবে যোগ করা হয়েছে। ডিফল্ট পাসওয়ার্ড: Shishir`);
      setNewEmail('');
      setNewName('');
      setTimeout(() => setShowAddUser(false), 3000);
    } catch (error: any) {
      console.error(error);
      setAddError(error.message || 'ব্যবহারকারী যোগ করতে সমস্যা হয়েছে');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'editor' | 'user') => {
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setDeletingId(uid);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col z-[70] overflow-hidden">
      <div className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-300 transition-colors duration-300">
        <div className="bg-emerald-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center transition-colors duration-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={20} />
            ব্যবহারকারী ব্যবস্থাপনা
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAddUser(!showAddUser)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all text-sm font-bold"
            >
              <UserPlus size={18} />
              {showAddUser ? 'তালিকা দেখুন' : 'এডিটর যোগ করুন'}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-emerald-800 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-32">
          {showAddUser ? (
            <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 animate-in slide-in-from-bottom-4 duration-300 transition-colors duration-300">
              <div className="text-center mb-6">
                <div className="bg-emerald-100 dark:bg-emerald-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-slate-200">নতুন এডিটর যোগ করুন</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">ডিফল্ট পাসওয়ার্ড হবে: <span className="font-bold text-emerald-600 dark:text-emerald-400">Shishir</span></p>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                {addError && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs border border-red-100 dark:border-red-900/30">{addError}</div>}
                {addSuccess && <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs border border-emerald-100 dark:border-emerald-900/30">{addSuccess}</div>}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">নাম</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="এডিটরের নাম"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">ইমেইল</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-1 opacity-60">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">ডিফল্ট পাসওয়ার্ড</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      disabled
                      value="Shishir"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {addLoading ? <Loader2 className="animate-spin" size={20} /> : 'এডিটর তৈরি করুন'}
                </button>
              </form>
            </div>
          ) : (
            loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32} />
                <p className="text-gray-500 dark:text-slate-400">লোড হচ্ছে...</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
                      <tr className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="p-4">ব্যবহারকারী</th>
                        <th className="p-4 text-center">ভূমিকা</th>
                        <th className="p-4 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {users.map((user, index) => (
                        <tr key={user.uid} className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-900/50'}`}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-100 dark:bg-emerald-900/20 p-2 rounded-full text-emerald-600 dark:text-emerald-400 shrink-0">
                                <User size={20} />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-800 dark:text-slate-200">{user.displayName}</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-500">{user.email}</p>
                                {user.points !== undefined && (
                                  <div className="flex items-center gap-1 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full w-fit border border-amber-100 dark:border-amber-900/30">
                                    <Award size={12} />
                                    <span>{user.points} পয়েন্ট</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                              {(['admin', 'editor', 'user'] as const).map((role) => (
                                <button
                                  key={role}
                                  disabled={updatingId === user.uid || user.role === role}
                                  onClick={() => handleRoleChange(user.uid, role)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    user.role === role 
                                      ? 'bg-emerald-600 text-white cursor-default shadow-sm' 
                                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                  } disabled:opacity-50`}
                                >
                                  {updatingId === user.uid && user.role !== role ? (
                                    <Loader2 className="animate-spin mx-auto" size={14} />
                                  ) : (
                                    role === 'admin' ? 'অ্যাডমিন' : role === 'editor' ? 'এডিটর' : 'সদস্য'
                                  )}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 align-middle text-center">
                            {user.email !== 'debashisbarmandb1@gmail.com' && (
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setShowDeleteConfirm(user.uid)}
                                  className="p-2 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  title="ব্যবহারকারী মুছুন"
                                >
                                  <Trash2 size={18} />
                                </button>
                                
                                {showDeleteConfirm === user.uid && (
                                  <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-xl shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-200 transition-colors duration-300">
                                    <div className="flex items-start gap-2 text-red-700 dark:text-red-400 mb-3 text-left">
                                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                      <p className="text-xs font-bold">আপনি কি নিশ্চিতভাবে এই ব্যবহারকারীকে মুছতে চান?</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleDeleteUser(user.uid)}
                                        disabled={deletingId === user.uid}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                      >
                                        {deletingId === user.uid ? <Loader2 size={12} className="animate-spin" /> : 'হ্যাঁ, মুছুন'}
                                      </button>
                                      <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                                      >
                                        না
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
