import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus, LogOut, Loader2, CheckCircle, Phone, MapPin, Droplet, Calendar, HelpCircle, Activity } from 'lucide-react';
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

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset link has been sent to your email.');
      setTimeout(() => setIsForgotPassword(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error sending email');
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
          setError('Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.');
          setLoading(false);
          return;
        }

        // Phone validation
        if (!phone.startsWith('01') || phone.length !== 11) {
          setError('Please enter a valid 11-digit phone number (e.g., 01xxxxxxxxx)');
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
      if (err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use by another account. If it was deleted, it might have been only removed from the database but not the authentication system.');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative z-[60]">
        {/* Ambient background for the whole page */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] dark:opacity-5"></div>
          <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
        </div>
        
        <div className="min-h-full flex items-center justify-center p-4 py-10">
          <div className="bg-white dark:bg-slate-900/90 backdrop-blur-xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-500 border border-slate-200/50 dark:border-slate-800/50 transition-colors rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
            <div className="relative bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-800 dark:to-emerald-950 px-6 pt-10 pb-12 text-white flex flex-col justify-center items-center text-center">
          {/* Logo element */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full blur-xl bg-emerald-300/30 dark:bg-emerald-400/20 animate-pulse"></div>
            <img src="/logo.png" alt="Shishir Logo" className="h-24 w-24 object-contain drop-shadow-2xl relative z-10 animate-pulse transition-all duration-1000 mx-auto" />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-8 flex items-center justify-center opacity-70">
              <svg width="120" height="20" viewBox="0 0 120 20" className="w-full h-full overflow-hidden">
                <polyline 
                  points="0,10 40,10 45,5 50,20 55,0 60,15 65,10 120,10" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-white drop-shadow-md"
                  style={{
                    strokeDasharray: 200,
                    strokeDashoffset: 200,
                    animation: "dash 2s linear infinite"
                  }}
                />
              </svg>
            </div>
            <style>
              {`
                @keyframes dash {
                  0% { stroke-dashoffset: 200; }
                  100% { stroke-dashoffset: -200; }
                }
              `}
            </style>
          </div>
          <h2 className="text-3xl font-black flex items-center gap-2 text-white font-outfit tracking-tighter mt-4 relative z-10">
            {verificationSent ? 'Email Verification' : (isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account'))}
          </h2>
          <p className="text-emerald-50/90 text-sm mt-2 z-10 text-center font-bold tracking-wide">
            {isLogin && !verificationSent && !isForgotPassword ? 'Login to continue to your dashboard' : ''}
            {!isLogin && !verificationSent && !isForgotPassword ? 'Join Shishir Voluntary Organization' : ''}
          </p>
          {isClosable && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-emerald-700 dark:hover:bg-emerald-800 rounded-full transition-colors text-white">
              <X size={20} />
            </button>
          )}
          {/* Decorative background shapes */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500 rounded-full opacity-50 dark:opacity-20 blur-2xl"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-emerald-400 rounded-full opacity-50 dark:opacity-20 blur-xl"></div>
        </div>

        <div className="dark:bg-slate-900 transition-colors duration-300 py-6 w-full">
          {verificationSent ? (
            <div className="p-8 text-center space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <Mail size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-emerald-50">Check Your Email</h3>
              <p className="text-gray-600 dark:text-slate-400">
                We have sent a verification link to <b>{email}</b>. Please verify your email and login again.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
              >
                OK
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
                <p className="text-sm text-gray-600 dark:text-slate-400">Enter your email address, we will send you a link to reset your password.</p>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Email</label>
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
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 text-sm font-semibold transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                {!isLogin && (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl mb-6 border border-emerald-100 dark:border-emerald-900/20 text-center">
                      <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1">Register as Blood Donor</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">Please provide your information correctly so that we can contact you.</p>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Name</label>
                      <div className="relative group">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                          placeholder="Your Name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Phone Number</label>
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
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Blood Group</label>
                        <div className="relative group">
                          <Droplet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                          <select
                            required
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all appearance-none shadow-sm"
                          >
                            <option value="" className="dark:bg-slate-900">Select</option>
                            {BLOOD_GROUPS_LIST.map(bg => (
                              <option key={bg} value={bg} className="dark:bg-slate-900">{bg}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Address/Area</label>
                      <div className="relative group">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none transition-all shadow-sm"
                          placeholder="Your Area"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Last Donation Date (Optional)</label>
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
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Email</label>
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
                    <label className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Password</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 uppercase tracking-wider transition-colors"
                      >
                        Forgot Password?
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
                          8+ chars, upper+lower, numbers & special chars
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
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Login' : 'Sign Up')}
                </button>

                <div className="text-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-semibold transition-colors"
                  >
                    {isLogin ? 'Want to create a new account?' : 'Already have an account? Login'}
                  </button>
                </div>
              </>
            )}
          </form>
          )}
        </div>
      </div>
      </div>
      </div>
    </>
  );
};

export default Auth;
