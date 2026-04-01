import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { X, User, Mail, Phone, Lock, Save, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileProps {
  userProfile: UserProfile | null;
  onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ userProfile, onClose }) => {
  const [email, setEmail] = useState(auth.currentUser?.email || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Verification states
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [showReauth, setShowReauth] = useState(false);

  const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailChanged = email !== auth.currentUser?.email;
    const phoneChanged = phone !== userProfile?.phone;

    setIsSaving(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not found');

      // Update Firestore profile
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          displayName,
          phone
        });
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.UPDATE, `users/${user.uid}`);
        return;
      }

      // Update Email if changed (using native Firebase verification)
      if (emailChanged) {
        try {
          await verifyBeforeUpdateEmail(user, email);
          setEmailVerificationSent(true);
          setMessage({ type: 'success', text: 'প্রোফাইল আপডেট হয়েছে। ইমেইল পরিবর্তনের জন্য আপনার নতুন ইমেইলে পাঠানো লিঙ্কে ক্লিক করুন।' });
        } catch (error: any) {
          console.error('Email update error:', error);
          if (error.code === 'auth/requires-recent-login') {
            setShowReauth(true);
            setIsSaving(false);
            return;
          }
          throw error;
        }
      } else {
        setMessage({ type: 'success', text: 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে!' });
      }

      if (!emailChanged) {
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordUser) {
      setMessage({ type: 'error', text: 'আপনি গুগল দিয়ে লগইন করেছেন, তাই এখান থেকে পাসওয়ার্ড পরিবর্তন করা সম্ভব নয়।' });
      return;
    }

    if (!newPassword || !currentPassword) {
      setMessage({ type: 'error', text: 'উভয় পাসওয়ার্ড প্রদান করা আবশ্যক।' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User or email not found');

      // Re-authenticate first to verify current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Then update to new password
      await updatePassword(user, newPassword);

      setMessage({ type: 'success', text: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
      setNewPassword('');
      setCurrentPassword('');
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error('Password update error:', error);
      const errorCode = error.code || '';
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-mismatch') {
        setMessage({ type: 'error', text: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়।' });
      } else if (errorCode === 'auth/weak-password') {
        setMessage({ type: 'error', text: 'নতুন পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে।' });
      } else {
        setMessage({ type: 'error', text: 'পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReauthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User not found');

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      setShowReauth(false);
      // Retry update
      await handleUpdateProfile(e);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'বর্তমান পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন।' });
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col z-[80] overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden transition-colors duration-300"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-800 dark:to-teal-900 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">আমার প্রোফাইল</h2>
                <p className="text-emerald-100 dark:text-emerald-200 text-[10px] font-bold uppercase tracking-widest opacity-80">ব্যক্তিগত তথ্য ও নিরাপত্তা</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 dark:bg-slate-900 transition-colors duration-300">
          <AnimatePresence mode="wait">
            {showReauth ? (
              <motion.form 
                key="reauth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleReauthenticate}
                className="space-y-6"
              >
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                  <ShieldCheck className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">নিরাপত্তার স্বার্থে ইমেইল পরিবর্তন করতে আপনার বর্তমান পাসওয়ার্ড প্রদান করুন।</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">বর্তমান পাসওয়ার্ড</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input 
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowReauth(false)}
                    className="flex-1 py-4 rounded-2xl text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    নিশ্চিত করুন
                  </button>
                </div>
              </motion.form>
            ) : isChangingPassword ? (
              <motion.form 
                key="password-change"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleChangePassword}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 mb-2">
                  <Lock size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-black text-sm uppercase tracking-wider">পাসওয়ার্ড পরিবর্তন</h3>
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-xs font-bold">{message.text}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">বর্তমান পাসওয়ার্ড</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input 
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                      placeholder="আপনার বর্তমান পাসওয়ার্ড"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">নতুন পাসওয়ার্ড</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input 
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                      placeholder="নতুন পাসওয়ার্ড লিখুন"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setMessage(null);
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                    className="flex-1 py-4 rounded-2xl text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    পাসওয়ার্ড আপডেট
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div 
                key="profile-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {message && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-xs font-bold">{message.text}</p>
                  </div>
                )}

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <User size={18} className="text-emerald-600 dark:text-emerald-400" />
                      <h3 className="font-black text-sm uppercase tracking-wider">ব্যক্তিগত তথ্য</h3>
                    </div>
                    {!isEditing && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 uppercase tracking-widest px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30 transition-all"
                      >
                        ইডিট করুন
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">নাম</label>
                        <input 
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ইমেইল</label>
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ফোন নাম্বার</label>
                        <input 
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:focus:border-emerald-600 outline-none transition-all font-bold"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button 
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-4 rounded-2xl text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                          বাতিল
                        </button>
                        <button 
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          সংরক্ষণ
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">নাম</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{displayName}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ইমেইল</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{email}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ফোন নাম্বার</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{phone || 'যুক্ত করা হয়নি'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    {!isPasswordUser ? (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
                        <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                        <p className="text-[10px] text-blue-800 dark:text-blue-200 font-bold">আপনি গুগল দিয়ে লগইন করেছেন। পাসওয়ার্ড পরিবর্তন করতে আপনার গুগল অ্যাকাউন্ট সেটিংস ব্যবহার করুন।</p>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setIsChangingPassword(true);
                          setMessage(null);
                        }}
                        className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Lock size={16} />
                        পাসওয়ার্ড পাল্টান
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
