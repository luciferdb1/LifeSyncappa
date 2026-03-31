import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus, LogOut, Loader2, CheckCircle, Phone, MapPin, Droplet, Calendar, HelpCircle } from 'lucide-react';
import { BLOOD_GROUPS_LIST } from '../constants';
import { BloodGroup } from '../types';

interface AuthProps {
  onClose: () => void;
  isClosable?: boolean;
}

const Auth: React.FC<AuthProps> = ({ onClose, isClosable = true }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [location, setLocation] = useState('');
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score: 0, label: '', color: 'bg-gray-200' };
    
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: 'দুর্বল', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'মাঝারি', color: 'bg-yellow-500' };
    return { score, label: 'শক্তিশালী', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে।');
      setTimeout(() => setIsForgotPassword(false), 3000);
    } catch (err: any) {
      setError(err.message || 'ইমেইল পাঠাতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) return handleForgotPassword(e);
    
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          // We'll handle the unverified state in App.tsx, but we can also show a message here
          // For now, just let them log in and App.tsx will block them
        }
      } else {
        // Password complexity validation
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        const hasSymbols = /[^A-Za-z0-9]/.test(password);
        
        if (password.length < 8 || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSymbols) {
          setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে এবং এতে বড় হাতের অক্ষর, ছোট হাতের অক্ষর, সংখ্যা এবং স্পেশাল ক্যারেক্টার থাকতে হবে।');
          setLoading(false);
          return;
        }

        // Phone validation
        if (!phone.startsWith('01') || phone.length !== 11) {
          setError('সঠিক ১১ ডিজিটের ফোন নাম্বার দিন (যেমন: 01xxxxxxxxx)');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Send verification email
        await sendEmailVerification(user);
        setVerificationSent(true);
        
        // Create user profile in Firestore
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: displayName,
            phone: phone,
            role: user.email?.toLowerCase() === 'debashisbarmandb1@gmail.com' ? 'admin' : 'user',
            uid: user.uid
          });
        } catch (fsError) {
          handleFirestoreError(fsError, OperationType.CREATE, `users/${user.uid}`);
          return;
        }

        // Add as a donor if it's a new registration
        if (phone && bloodGroup && location) {
          try {
            await addDoc(collection(db, 'donors'), {
              name: displayName,
              phone: phone,
              bloodGroup: bloodGroup,
              location: location,
              lastDonationDate: lastDonationDate || "",
              totalDonations: 0,
              isAvailable: true,
              uid: user.uid
            });
          } catch (fsError) {
            handleFirestoreError(fsError, OperationType.CREATE, 'donors');
            return;
          }
        }
        
        // Don't close yet if verification is sent, show the message
        return;
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh] border border-transparent dark:border-slate-800 transition-colors duration-300">
        <div className="bg-emerald-900 dark:bg-emerald-950 p-6 text-white flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            {verificationSent ? <CheckCircle size={20} /> : (isForgotPassword ? <HelpCircle size={20} /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />))}
            {verificationSent ? 'ইমেইল ভেরিফিকেশন' : (isForgotPassword ? 'পাসওয়ার্ড রিসেট' : (isLogin ? 'লগইন করুন' : 'অ্যাকাউন্ট তৈরি করুন'))}
          </h2>
          {isClosable && (
            <button onClick={onClose} className="p-1 hover:bg-emerald-800 dark:hover:bg-emerald-900 rounded-full transition-colors text-white">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 dark:bg-slate-900 transition-colors duration-300">
          {verificationSent ? (
            <div className="p-8 text-center space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <Mail size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-emerald-50">আপনার ইমেইল চেক করুন</h3>
              <p className="text-gray-600 dark:text-slate-400">
                আমরা <b>{email}</b> ঠিকানায় একটি ভেরিফিকেশন লিঙ্ক পাঠিয়েছি। দয়া করে আপনার ইমেইল ভেরিফাই করে পুনরায় লগইন করুন।
              </p>
              <button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
              >
                ঠিক আছে
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-sm border border-emerald-100 dark:border-emerald-900/30">
                {success}
              </div>
            )}

            {isForgotPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-slate-400">আপনার ইমেইল ঠিকানা দিন, আমরা আপনাকে পাসওয়ার্ড রিসেট করার লিঙ্ক পাঠিয়ে দেব।</p>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">ইমেইল</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all"
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'রিসেট লিঙ্ক পাঠান'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 text-sm font-semibold transition-colors"
                >
                  লগইন পেজে ফিরে যান
                </button>
              </div>
            ) : (
              <>
                {!isLogin && (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl mb-4 border border-emerald-100 dark:border-emerald-900/20">
                      <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1">রক্তদাতা হিসেবে নিবন্ধন</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">আপনার তথ্যগুলো সঠিকভাবে দিন যাতে প্রয়োজনে আপনার সাথে যোগাযোগ করা যায়।</p>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">নাম</label>
                      <div className="relative group">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                          placeholder="আপনার নাম"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">ফোন নম্বর</label>
                        <div className="relative group">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                            placeholder="017XXXXXXXX"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">রক্তের গ্রুপ</label>
                        <div className="relative group">
                          <Droplet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                          <select
                            required
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all appearance-none shadow-sm"
                          >
                            <option value="" className="dark:bg-slate-900">নির্বাচন করুন</option>
                            {BLOOD_GROUPS_LIST.map(bg => (
                              <option key={bg} value={bg} className="dark:bg-slate-900">{bg}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">ঠিকানা/এলাকা</label>
                      <div className="relative group">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                          placeholder="আপনার এলাকা"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">শেষ রক্তদানের তারিখ (ঐচ্ছিক)</label>
                      <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                          type="date"
                          value={lastDonationDate}
                          onChange={(e) => setLastDonationDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">ইমেইল</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all"
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">পাসওয়ার্ড</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 uppercase tracking-wider transition-colors"
                      >
                        পাসওয়ার্ড ভুলে গেছেন?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  {!isLogin && password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 h-1.5 w-full">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div 
                            key={level} 
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              strength.score >= level ? strength.color : 'bg-gray-200 dark:bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-medium">
                        <span className={
                          strength.score <= 2 ? 'text-red-500' : 
                          strength.score <= 4 ? 'text-yellow-600' : 'text-emerald-600 dark:text-emerald-400'
                        }>
                          {strength.label}
                        </span>
                        <span className="text-gray-400 dark:text-slate-500">
                          ৮+ অক্ষর, বড়+ছোট হাতের, সংখ্যা ও স্পেশাল ক্যারেক্টার
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'লগইন' : 'সাইন আপ')}
                </button>

                <div className="text-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-semibold transition-colors"
                  >
                    {isLogin ? 'নতুন অ্যাকাউন্ট তৈরি করতে চান?' : 'আগের অ্যাকাউন্ট আছে? লগইন করুন'}
                  </button>
                </div>
              </>
            )}
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
