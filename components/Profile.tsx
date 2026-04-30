import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  updateEmail,
  updateProfile
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { X, User, Mail, Phone, Lock, Save, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Smartphone, Award, Shield, Edit, AlertTriangle, Check, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRoleBadgeDefinition } from '../lib/roleUtils';

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

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [showReauth, setShowReauth] = useState(false);
  
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingAction, setPendingAction] = useState<'profile' | 'password' | null>(null);

  const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  const executeProfileUpdate = async () => {
    const emailChanged = email !== auth.currentUser?.email;

    setIsSaving(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not found');

      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          displayName,
          phone,
        });
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.UPDATE, `users/${user.uid}`);
        return;
      }

      if (emailChanged) {
        try {
          await updateEmail(user, email);
          setMessage({ type: 'success', text: 'Profile updated successfully!' });
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
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }

      if (!emailChanged) {
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'Error updating profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailChanged = email !== auth.currentUser?.email;
    const phoneChanged = phone !== userProfile?.phone;

    if (emailChanged || phoneChanged) {
      setIsSaving(true);
      setMessage(null);
      try {
        const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: auth.currentUser?.email })
        });
        const data = await response.json();
        if (data.success) {
          setPendingAction('profile');
          setShowOtpInput(true);
          setMessage({ type: 'success', text: 'An OTP has been sent to your email.' });
        } else {
          setMessage({ type: 'error', text: data.error || 'Error sending OTP.' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Error sending OTP.' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    await executeProfileUpdate();
  };

  const executePasswordUpdate = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User or email not found');

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setNewPassword('');
      setCurrentPassword('');
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error('Password update error:', error);
      const errorCode = error.code || '';
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-mismatch') {
        setMessage({ type: 'error', text: 'Current password is incorrect.' });
      } else if (errorCode === 'auth/weak-password') {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      } else {
        setMessage({ type: 'error', text: 'Error updating password. Please try again.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordUser) {
      setMessage({ type: 'error', text: 'You logged in with Google, so you cannot change your password from here.' });
      return;
    }

    if (!newPassword || !currentPassword) {
      setMessage({ type: 'error', text: 'Both passwords are required.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auth.currentUser?.email })
      });
      const data = await response.json();
      if (data.success) {
        setPendingAction('password');
        setShowOtpInput(true);
        setMessage({ type: 'success', text: 'An OTP has been sent to your email.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error sending OTP.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error sending OTP.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auth.currentUser?.email, otp })
      });
      const data = await response.json();
      
      if (data.success) {
        setShowOtpInput(false);
        setOtp('');
        if (pendingAction === 'profile') {
          await executeProfileUpdate();
        } else if (pendingAction === 'password') {
          await executePasswordUpdate();
        }
        setPendingAction(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Incorrect OTP provided.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error verifying OTP.' });
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
      if (pendingAction === 'password') {
        await executePasswordUpdate();
      } else {
        await executeProfileUpdate();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Current password is incorrect. Please try again.' });
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Background Decorative Elements - More Dynamic */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-[10%] right-[20%] w-[45%] h-[45%] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[110px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex-1 flex flex-col min-h-0"
      >
        {/* We removed the explicit Ultra Premium Glassmorphism header to merge it into the main card */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-24 pt-6 px-4 sm:px-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* New Digital Profile Detail Card */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-3xl p-6 sm:p-10 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                {/* Large Profile Picture */}
                <div className="relative group mb-6">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-2xl border-4 border-white dark:border-slate-700 overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20"></div>
                    {auth.currentUser?.photoURL || userProfile?.photoUrl ? (
                      <img src={auth.currentUser?.photoURL || userProfile?.photoUrl || ''} alt="Profile" className="w-full h-full object-cover relative z-10" />
                    ) : (
                      <User size={56} className="text-emerald-600 dark:text-emerald-400 relative z-10" />
                    )}
                  </div>
                  {/* Category Badge */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30">
                    {(() => {
                      const userRoleStr = userProfile?.role || 'user';
                      if (userRoleStr === 'user' || userRoleStr === 'volunteer' || userRoleStr === 'blood_donor' || userRoleStr === '') return null; // Hide 'User' texts next to users
                      const roleBadge = getRoleBadgeDefinition(userRoleStr);
                      return (
                        <div className={`flex items-center gap-1.5 px-4 py-1.5 ${roleBadge.color.split(' ')[0]} ${roleBadge.color.includes('text') ? roleBadge.color.split(' ').find(c => c.startsWith('text-')) : 'text-white'} text-xs font-black uppercase tracking-[0.2em] rounded-full shadow-lg border-2 border-white dark:border-slate-800 whitespace-nowrap`}>
                          {userProfile?.role === 'admin' ? <Shield size={14} /> : 
                           userProfile?.role === 'president' ? <Award size={14} /> : 
                           <User size={14} />}
                          {roleBadge.label}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="text-center mt-4 mb-8 w-full">
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white font-outfit mb-1">
                    {displayName || 'Not Set'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-widest lowercase mb-1">
                    {email} / <span className="uppercase">{userProfile?.uid?.slice(0, 8)}</span>
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm font-black tracking-widest uppercase">
                    {phone || 'Phone Not Set'}
                  </p>
                </div>

                {/* Inline Forms and Action Buttons inside the Profile Card */}
                <div className="w-full space-y-6">
                  {message && !showOtpInput && !showReauth && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                      {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      <p className="text-sm font-bold leading-relaxed">{message.text}</p>
                    </div>
                  )}

                  {/* Edit Profile Form */}
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-slate-900 dark:text-white mb-2">
                      <div className="w-8 h-8 flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <Edit size={16} />
                      </div>
                      <h3 className="font-bold text-sm tracking-tight uppercase">Update Info</h3>
                    </div>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 group">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="text"
                              required
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 group">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <button 
                        type="submit"
                        disabled={isSaving && pendingAction === 'profile'}
                        className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-emerald-600 text-white font-bold uppercase text-[10px] shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 ml-auto"
                      >
                        {isSaving && pendingAction === 'profile' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Changes
                      </button>
                    </form>
                  </div>

                  {/* Change Password Form */}
                  {isPasswordUser && (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-2xl shadow-sm space-y-4">
                      <div className="flex items-center gap-3 text-slate-900 dark:text-white mb-2">
                        <div className="w-8 h-8 flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <Lock size={16} />
                        </div>
                        <h3 className="font-bold text-sm tracking-tight uppercase">Change Password</h3>
                      </div>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1 group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                type="password"
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-1 group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-sm"
                              />
                            </div>
                          </div>
                        </div>
                        <button 
                          type="submit"
                          disabled={isSaving && pendingAction === 'password'}
                          className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-blue-600 text-white font-bold uppercase text-[10px] shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 ml-auto"
                        >
                          {isSaving && pendingAction === 'password' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Update Password
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Logout Button */}
                  <button
                    onClick={async () => {
                      await auth.signOut();
                      onClose();
                    }}
                    className="w-full py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white font-black uppercase tracking-widest text-[11px] shadow-sm transition-all flex items-center justify-center gap-3 group border border-red-100 dark:border-red-900/30"
                  >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {showOtpInput ? (
                <motion.form 
                  key="otp-verify"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleVerifyOtp}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6"
                >
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex gap-4">
                    <ShieldCheck className="text-blue-600 dark:text-blue-400 shrink-0" size={28} />
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium leading-relaxed">A 6-digit OTP has been sent to your email. Please enter it below to verify your identity.</p>
                  </div>

                  {message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                      {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      <p className="text-sm font-bold leading-relaxed">{message.text}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">OTP Code</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                      <input 
                        type="text"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-black text-xl tracking-[0.5em] text-center"
                        placeholder="••••••"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowOtpInput(false);
                        setPendingAction(null);
                        setMessage(null);
                        setOtp('');
                      }}
                      className="flex-1 py-3 rounded-xl text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving || otp.length < 6}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Verify
                    </button>
                  </div>
                </motion.form>
              ) : showReauth ? (
                <motion.form 
                  key="reauth"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleReauthenticate}
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-5"
                >
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                    <ShieldCheck className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium leading-relaxed">For security reasons, please provide your current password to change your email.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                      <input 
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-bold text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowReauth(false)}
                      className="flex-1 py-3 rounded-xl text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 dark:shadow-none hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Confirm
                    </button>
                  </div>
                </motion.form>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  </>
  );
};

export default Profile;
