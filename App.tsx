import React, { useState, useEffect } from 'react';
import './index.css';
import { Droplet, Search, Shield, Lock, Menu, Phone, Loader2, Database, CheckCircle2, LogOut, User as UserIcon, Users, ClipboardList, Plus, Mail, Trophy, X, PhoneCall, Home, Moon, Sun } from 'lucide-react';
import { Donor, BloodGroup, UserProfile } from './types';
import { INITIAL_DONORS, BLOOD_GROUPS_LIST, MAIN_ADMIN_EMAIL } from './constants';
import DonorCard from './components/DonorCard';
import AdminPanel from './components/AdminPanel';
import AIChat from './components/AIChat';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import RequestModal from './components/RequestModal';
import Profile from './components/Profile';
import RecordDonationModal from './components/RecordDonationModal';
import CallInterface from './components/CallInterface';
import { logActivity } from './services/logService';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User, sendEmailVerification } from 'firebase/auth';
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';


// Custom Logo Component based on the Shishir Voluntary Organization brand
const ShishirLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Roof / Home Shape (Green) */}
    <path d="M20 80 L100 20 L180 80" stroke="#047857" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
    
    {/* Blood Drop (Red) */}
    <path d="M100 45 C100 45 50 100 50 135 C50 162.6 72.4 185 100 185 C127.6 185 150 162.6 150 135 C150 100 100 45 100 45 Z" fill="#DC2626"/>
    
    {/* Leaf (Green) - Stylized */}
    <path d="M180 20 C180 20 180 60 150 80 C150 80 130 50 150 30" fill="#4ADE80" stroke="#047857" strokeWidth="4"/>
    
    {/* Human Figure inside Drop (White negative space abstract) */}
    <circle cx="100" cy="115" r="12" fill="white"/>
    <path d="M85 150 C85 150 90 130 100 130 C110 130 115 150 115 150" stroke="white" strokeWidth="6" strokeLinecap="round"/>
  </svg>
);

const App: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'user' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminInitialView, setAdminInitialView] = useState<'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'addDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig'>('menu');
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedDonorForRequest, setSelectedDonorForRequest] = useState<Donor | null>(null);
  const [selectedDonorForDonation, setSelectedDonorForDonation] = useState<Donor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{number: string, name: string, donorId: string, alreadyAgreed: boolean} | null>(null);
  const [callWarning, setCallWarning] = useState<{donor: Donor, callerName: string} | null>(null);
  const [refusalWarning, setRefusalWarning] = useState<{donor: Donor, reason: string, date: string} | null>(null);
  const [hasShownFollowUpAlert, setHasShownFollowUpAlert] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved !== null) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Listen for system theme changes if no manual preference is set
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme');
      if (saved === null) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleDonorAgreed = async (donorId: string) => {
    if (!currentUser || userRole !== 'editor') return;

    try {
      const donorRef = doc(db, 'donors', donorId);
      await updateDoc(donorRef, {
        agreedToDonate: true,
        convincedByUid: currentUser.uid,
        convincedByName: userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Editor'
      });

      // Log activity only when agreed
      const donorSnap = await getDoc(donorRef);
      const donorData = donorSnap.data() as Donor;
      await logActivity(donorId, 'call', donorData.name, 'কল করার পর রক্ত দিতে রাজি হয়েছেন');

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        points: increment(5),
        pointsFromConvinced: increment(5)
      });

      setCustomAlert("অভিনন্দন! আপনি ৫ পয়েন্ট পেয়েছেন।");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donorId}`);
    }
  };

  const handleDonorRefused = async (donorId: string, reason: string) => {
    if (!currentUser || userRole !== 'editor') return;

    try {
      const donorRef = doc(db, 'donors', donorId);
      await updateDoc(donorRef, {
        lastRefusalReason: reason,
        lastRefusalDate: new Date().toISOString()
      });
      setCustomAlert("তথ্যটি সংরক্ষিত হয়েছে।");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donorId}`);
    }
  };

  const handleInitiateCall = (donor: Donor, force: boolean = false) => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }

    if (!force) {
      // Check if donor is already convinced by someone else
      if (donor.agreedToDonate && donor.convincedByUid && donor.convincedByUid !== currentUser.uid) {
        setCallWarning({ donor, callerName: donor.convincedByName || 'অন্য একজন এডিটর' });
        return;
      }

      // Check for recent refusal (within 7 days)
      if (donor.lastRefusalDate) {
        const refusalDate = new Date(donor.lastRefusalDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - refusalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7) {
          setRefusalWarning({ donor, reason: donor.lastRefusalReason || 'কোনো কারণ উল্লেখ করা হয়নি', date: donor.lastRefusalDate });
          return;
        }
      }
    }

    // Otherwise, proceed with call
    // @ts-ignore
    if (window.Android && window.Android.makeSipCall) {
      const callerUid = currentUser.uid;
      const callerName = userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Admin';
      // @ts-ignore
      window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
      setActiveCall({ number: donor.phone, name: donor.name, donorId: donor.id, alreadyAgreed: !!donor.agreedToDonate });
    } else {
      setCustomAlert("SIP কলিং শুধুমাত্র অ্যান্ড্রয়েড অ্যাপ থেকে সমর্থিত। অনুগ্রহ করে অ্যাপ ব্যবহার করুন।");
    }
  };
  // SIP Connection Simulation - only for admins/editors
  useEffect(() => {
    if (typeof window !== 'undefined' && (userRole === 'admin' || userRole === 'editor')) {
      // @ts-ignore
      if (!window.Android) window.Android = {};

      // @ts-ignore
      if (!window.Android.makeSipCall) {
        console.log("Mocking Android SIP Interface for development...");
        // @ts-ignore
        window.Android.makeSipCall = (number: string, name?: string) => {
          // @ts-ignore
          if (window.showCallInterface) {
            // @ts-ignore
            window.showCallInterface(number, name || 'Unknown');
          }
        };
      }

      // Expose a global function to trigger the simulation from the config modal
      // @ts-ignore
      window.simulateAndroidSipConnection = () => {
        // @ts-ignore
        if (window.updateSipStatus) {
          // @ts-ignore
          window.updateSipStatus('connecting');
          setTimeout(() => {
            // @ts-ignore
            window.updateSipStatus('connected');
          }, 2000);
        }
      };

      // Check for SIP config and simulate connection
      getDoc(doc(db, 'settings', 'sipConfig')).then(docSnap => {
        if (docSnap.exists() && docSnap.data().domain) {
          // @ts-ignore
          if (window.simulateAndroidSipConnection) window.simulateAndroidSipConnection();
        }
      }).catch(err => {
        // Only log if it's not a permission error, or if we want to see it
        if (err.code !== 'permission-denied') {
          console.error("Error fetching SIP config:", err);
        }
      });
    }
  }, [userRole]);

  useEffect(() => {
    // @ts-ignore
    window.showAppAlert = (msg: string) => setCustomAlert(msg);
    // @ts-ignore
    window.showCallInterface = (number: string, name: string, donorId?: string) => setActiveCall({number, name, donorId: donorId || ''});
  }, []);

  // Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    
    // Safety timeout to prevent infinite loading if Firebase hangs
    const safetyTimeout = setTimeout(() => {
      if (isAuthLoading) {
        console.warn("Auth loading taking too long, forcing load state to false.");
        setIsAuthLoading(false);
      }
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = undefined;
      }

      if (user) {
        // Immediate check for main admin
        const isMainAdmin = user.email?.toLowerCase() === MAIN_ADMIN_EMAIL;
        if (isMainAdmin) setUserRole('admin');

        // Real-time listener for user profile
        try {
          unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
            try {
              if (userDoc.exists()) {
                const data = userDoc.data() as UserProfile;
                setUserProfile(data);
                const role = data.role;
                if (isMainAdmin && user.emailVerified && role !== 'admin') {
                  await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
                  setUserRole('admin');
                } else {
                  setUserRole(role);
                }
              } else {
                const defaultRole = (isMainAdmin && user.emailVerified) ? 'admin' : 'user';
                setUserRole(defaultRole);
                await setDoc(doc(db, 'users', user.uid), {
                  email: user.email,
                  role: defaultRole,
                  uid: user.uid,
                  displayName: user.displayName || user.email?.split('@')[0] || 'User'
                });
              }
            } catch (innerError) {
              console.error("Error processing user profile snapshot:", innerError);
            } finally {
              setIsAuthLoading(false);
              clearTimeout(safetyTimeout);
            }
          }, (error) => {
            console.error("Error listening to user profile:", error);
            setIsAuthLoading(false);
            clearTimeout(safetyTimeout);
          });
        } catch (outerError) {
          console.error("Error setting up user profile listener:", outerError);
          setIsAuthLoading(false);
          clearTimeout(safetyTimeout);
        }
      } else {
        setUserRole(null);
        setShowAdmin(false);
        setIsAuthLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Firestore Real-time Listener for Donors
  useEffect(() => {
    if (!currentUser) {
      setDonors(INITIAL_DONORS);
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'donors'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const donorList: Donor[] = [];
      snapshot.forEach((doc) => {
        donorList.push({ id: doc.id, ...doc.data() } as Donor);
      });
      setDonors(donorList);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'donors');
      setDonors([]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, userRole]);

  // Filter Logic
  useEffect(() => {
    if (selectedGroup) {
      setFilteredDonors(donors.filter(d => d.bloodGroup === selectedGroup));
    } else {
      setFilteredDonors(donors);
    }
  }, [selectedGroup, donors]);

  useEffect(() => {
    if (userRole === 'admin' && donors.length > 0) {
      const now = new Date();
      let count = 0;
      
      donors.forEach(donor => {
        if (!donor.lastDonationDate) return;
        
        const donationDate = new Date(donor.lastDonationDate);
        const diffTime = now.getTime() - donationDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let needsFollowUp = false;
        
        if (diffDays >= 3 && donor.followUp3DayStatus !== 'completed') {
          if (donor.followUp3DayStatus === 'failed' && donor.followUp3DayNextReminder) {
            if (now >= new Date(donor.followUp3DayNextReminder)) needsFollowUp = true;
          } else {
            needsFollowUp = true;
          }
        }
        
        if (diffDays >= 7 && donor.followUp7DayStatus !== 'completed') {
          if (donor.followUp7DayStatus === 'failed' && donor.followUp7DayNextReminder) {
            if (now >= new Date(donor.followUp7DayNextReminder)) needsFollowUp = true;
          } else {
            needsFollowUp = true;
          }
        }
        
        if (needsFollowUp) count++;
      });
      
      if (count > 0 && !hasShownFollowUpAlert) {
        setCustomAlert(`আপনার জন্য ${count} টি ফলোআপ কল বাকি আছে। দয়া করে অ্যাডমিন প্যানেল থেকে "ফলোআপ কল" অপশনে গিয়ে ডোনারদের সাথে যোগাযোগ করুন।`);
        setHasShownFollowUpAlert(true);
      }
    }
  }, [userRole, donors.length, hasShownFollowUpAlert]); // Only run when userRole changes or initial donors load

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isDonorEligible = (donor: Donor) => {
    if (!donor.isAvailable) return false;
    if (!donor.lastDonationDate || donor.lastDonationDate === "") return true;
    
    const lastDate = new Date(donor.lastDonationDate);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 120;
  };

  const readyToDonateCount = filteredDonors.filter(isDonorEligible).length;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="bg-blob blob-green opacity-20 dark:opacity-10" />
        <div className="bg-blob blob-red opacity-10 dark:opacity-5" />
        
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
        
        {/* Navbar */}
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 border-b border-emerald-100/50 dark:border-slate-800/50 transition-colors duration-300">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-20 md:h-24">
              {/* Left: Logo and Title */}
              <div 
                className="flex items-center gap-3 md:gap-4 cursor-pointer group" 
                onClick={() => {
                  setSelectedGroup('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div className="h-12 w-12 md:h-16 md:w-16 relative flex-shrink-0 transition-transform group-hover:scale-110 duration-500">
                    <ShishirLogo className="h-full w-full drop-shadow-xl" />
                </div>
                <div className="flex flex-col">
                   <h1 className="text-xl md:text-3xl font-black text-emerald-900 dark:text-emerald-400 leading-none font-outfit tracking-tight">শিশির</h1>
                   <p className="text-[10px] md:text-[12px] text-red-600 dark:text-red-400 font-black tracking-[0.3em] uppercase mt-1">স্বেচ্ছাসেবী সংগঠন</p>
                </div>
              </div>

              {/* Center: Navigation Links (Desktop) */}
              <div className="hidden md:flex items-center gap-8 lg:gap-12">
                <button 
                  onClick={() => {
                    setSelectedGroup('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`relative py-2 text-sm font-black uppercase tracking-widest transition-all group ${!selectedGroup ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                >
                  <span className="flex items-center gap-2">
                    <Home size={18} />
                    <span>হোম</span>
                  </span>
                  {!selectedGroup && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
                  )}
                </button>
                
                {(userRole === 'admin' || userRole === 'editor' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL) && (
                  <button 
                    onClick={() => {
                      if (userRole === 'editor') {
                        setAdminInitialView('leaderboard');
                      } else {
                        setAdminInitialView('menu');
                      }
                      setShowAdmin(true);
                    }}
                    className={`relative py-2 text-sm font-black uppercase tracking-widest transition-all group ${showAdmin ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Shield size={18} />
                      <span>{userRole === 'editor' ? 'লিডারবোর্ড' : 'অ্যাডমিন প্যানেল'}</span>
                    </span>
                    {showAdmin && (
                      <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* Right: User Actions / Mobile Menu Toggle */}
              <div className="flex items-center gap-3 md:gap-6">
                {/* Dark Mode Toggle (Desktop) */}
                <button 
                  onClick={toggleDarkMode}
                  className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all duration-300 active:scale-90"
                  title={isDarkMode ? "লাইট মুড" : "ডার্ক মুড"}
                >
                  {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                </button>

                <div className="hidden sm:flex items-center">
                  {currentUser ? (
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setShowProfile(true)}
                        className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                        title="আমার প্রোফাইল"
                      >
                        <UserIcon size={22} />
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-700 transition-all px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95"
                      >
                        <LogOut size={16} />
                        <span className="hidden lg:inline">লগআউট</span>
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowAuth(true)}
                      className="flex items-center gap-2 text-white bg-emerald-600 hover:bg-emerald-700 transition-all px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      <Lock size={16} />
                      <span>লগইন</span>
                    </button>
                  )}
                </div>
                
                {/* Mobile Menu Button */}
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-3 text-emerald-900 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-90"
                >
                  {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
              </div>
            </div>
          </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white dark:bg-slate-900 border-t border-emerald-50 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Dark Mode Toggle (Mobile) */}
                <button 
                  onClick={() => {
                    toggleDarkMode();
                    // Don't close menu here to let user see the change
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all"
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                  <span>{isDarkMode ? "লাইট মুড" : "ডার্ক মুড"}</span>
                </button>

                <button 
                  onClick={() => {
                    setSelectedGroup('');
                    setIsMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                >
                  <Home size={20} />
                  <span>হোম</span>
                </button>

                {(userRole === 'admin' || userRole === 'editor' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL) && (
                  <button 
                    onClick={() => {
                      if (userRole === 'editor') {
                        setAdminInitialView('leaderboard');
                      } else {
                        setAdminInitialView('menu');
                      }
                      setShowAdmin(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                  >
                    <Shield size={20} />
                    <span>{userRole === 'editor' ? 'লিডারবোর্ড' : 'অ্যাডমিন প্যানেল'}</span>
                  </button>
                )}

                {currentUser && (
                  <button 
                    onClick={() => {
                      setShowProfile(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                  >
                    <UserIcon size={20} />
                    <span>আমার প্রোফাইল</span>
                  </button>
                )}

                {!currentUser ? (
                  <button 
                    onClick={() => {
                      setShowAuth(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20"
                  >
                    <Lock size={20} />
                    <span>লগইন করুন</span>
                  </button>
                ) : (
                  <div className="pt-2 space-y-3">
                    <button 
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                    >
                      <LogOut size={20} />
                      <span>লগআউট</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {currentUser && !showAdmin && !showProfile && !showAuth && !selectedGroup && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setAdminInitialIsAdding(true);
            setShowAdmin(true);
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-[0_12px_40px_-8px_rgba(5,150,105,0.4)] flex items-center justify-center z-40 border-4 border-white group overflow-hidden"
          title="নতুন রক্তদাতা যোগ করুন"
        >
          <Plus size={32} className="relative z-10" />
        </motion.button>
      )}

      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {showAdmin && currentUser && (
        <AdminPanel 
          onClose={() => {
            setShowAdmin(false);
            setAdminInitialView('menu');
            setEditingDonor(null);
          }} 
          userRole={userRole}
          initialView={adminInitialView}
          initialEditingDonor={editingDonor}
        />
      )}
      {showProfile && (
        <Profile 
          userProfile={userProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
      {selectedDonorForRequest && (
        <RequestModal 
          donor={selectedDonorForRequest} 
          onClose={() => setSelectedDonorForRequest(null)} 
        />
      )}
      {selectedDonorForDonation && (
        <RecordDonationModal
          donor={selectedDonorForDonation}
          onClose={() => setSelectedDonorForDonation(null)}
        />
      )}

      {/* Email Verification Overlay */}
      {currentUser && !currentUser.emailVerified && (
        <div className="fixed inset-0 bg-slate-900/80 dark:bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl shadow-2xl p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-red-50 dark:bg-red-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
              <Mail size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ইমেইল ভেরিফাই করুন</h2>
              <p className="text-gray-600 dark:text-slate-400">
                আপনার অ্যাকাউন্টটি সক্রিয় করতে ইমেইল ভেরিফিকেশন প্রয়োজন। আমরা <b>{currentUser.email}</b> ঠিকানায় একটি লিঙ্ক পাঠিয়েছি।
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-2xl text-sm text-amber-800 dark:text-amber-400 text-left flex gap-3">
              <Shield size={20} className="shrink-0 mt-0.5" />
              <p>ভেরিফিকেশন ছাড়া আপনি কোনো তথ্য দেখতে বা রক্তদাতার সাথে যোগাযোগ করতে পারবেন না।</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (currentUser) {
                    await currentUser.reload();
                    // Force token refresh to update email_verified claim
                    await currentUser.getIdToken(true);
                    window.location.reload();
                  }
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
              >
                ভেরিফাই করেছি (রিফ্রেশ করুন)
              </button>
              <button 
                onClick={async () => {
                  try {
                    await sendEmailVerification(currentUser);
                    alert("ভেরিফিকেশন ইমেইল পুনরায় পাঠানো হয়েছে।");
                  } catch (e: any) {
                    alert("ত্রুটি: " + e.message);
                  }
                }}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold text-sm"
              >
                লিঙ্ক পাননি? পুনরায় পাঠান
              </button>
              <button 
                onClick={handleLogout}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400 text-sm font-medium"
              >
                লগআউট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuthLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 transition-colors duration-300">
          <div className="h-24 w-24 mb-6">
            <ShishirLogo className="animate-pulse" />
          </div>
          <Loader2 className="animate-spin text-emerald-600 mb-2" size={32} />
          <p className="text-emerald-800 dark:text-emerald-400 font-bold font-hind">শিশির অ্যাপ লোড হচ্ছে...</p>
        </div>
      ) : !currentUser ? (
        <Auth onClose={() => {}} isClosable={false} />
      ) : userRole === 'user' && currentUser.email?.toLowerCase() !== MAIN_ADMIN_EMAIL ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center transition-colors duration-300">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-500 border border-slate-100 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <ShishirLogo className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">অ্যাক্সেস সীমিত</h2>
              <p className="text-gray-600 dark:text-slate-400 font-medium">
                অ্যাপটি ব্যবহারের জন্য শিশির স্বেচ্ছাসেবী সংগঠন-এর সাথে যোগাযোগ করুন।
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-4 rounded-2xl text-sm text-emerald-800 dark:text-emerald-400 flex flex-col items-center gap-2">
              <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
              <p>আপনার অ্যাকাউন্টটি বর্তমানে অনুমোদনের অপেক্ষায় রয়েছে।</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              লগআউট করুন
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Hero Section */}
      <div className="bg-[#006a4e] dark:bg-slate-950 text-white py-12 md:py-16 px-4 text-center relative overflow-hidden transition-colors duration-300">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600 rounded-full opacity-20 blur-3xl"></div>
           <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500 rounded-full opacity-10 blur-3xl"></div>
           <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg opacity-5" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
             <path fill="#FFFFFF" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.9C87.4,-34.7,90.1,-20.4,85.8,-8.3C81.5,3.8,70.2,13.7,60.8,24.6C51.4,35.5,43.9,47.4,34,56.1C24.1,64.8,11.8,70.3,-1.2,72.4C-14.2,74.5,-29.3,73.2,-42,65.6C-54.7,58,-65,44.1,-71.5,29.1C-78,14.1,-80.7,-2,-77.4,-16.8C-74.1,-31.6,-64.8,-45.1,-52.7,-53.1C-40.6,-61.1,-25.7,-63.6,-11.3,-65.5C3.1,-67.4,17.5,-68.7,30.5,-83.6L44.7,-76.4Z" transform="translate(100 100)" />
           </svg>
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto mt-4">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            রক্ত দিন, <span className="text-red-400">জীবন বাঁচান</span>
          </h2>
          <p className="text-lg md:text-xl text-emerald-100 mb-10 font-light">
            আপনার এক ব্যাগ রক্ত হতে পারে মুমূর্ষু রোগীর বেঁচে থাকার একমাত্র অবলম্বন।
          </p>
          
          {/* Search Box */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-2xl max-w-md mx-auto flex items-center transform transition-all hover:scale-105 duration-300 border border-emerald-100/20 dark:border-slate-800">
            <div className="pl-3 text-red-500 dark:text-red-400">
                <Search size={24} />
            </div>
            <div className="flex-1 px-2">
                <label className="block text-xs text-left text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-1">রক্তের গ্রুপ খুঁজুন</label>
                <select 
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full py-1 text-gray-800 dark:text-slate-200 text-lg bg-transparent outline-none font-bold cursor-pointer appearance-none"
                >
                  <option value="" className="dark:bg-slate-900">সব দেখুন</option>
                  {BLOOD_GROUPS_LIST.map(bg => (
                    <option key={bg} value={bg} className="dark:bg-slate-900">{bg}</option>
                  ))}
                </select>
            </div>
            <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-2">
                <Droplet className="text-emerald-600 dark:text-emerald-400" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 container mx-auto px-4 py-12 -mt-8 relative z-20">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-emerald-100 dark:border-slate-800 p-6 mb-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-400 flex items-center">
                    <span className="w-2 h-8 bg-red-500 rounded-full mr-3"></span>
                    {selectedGroup ? `${selectedGroup} গ্রুপের রক্তদাতারা` : 'সকল রক্তদাতা'}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full border border-red-100 dark:border-red-900/30">
                        মোট দাতা: <span className="font-bold">{filteredDonors.length}</span> জন
                    </span>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        প্রস্তুত: <span className="font-bold">{readyToDonateCount}</span> জন
                    </span>
                </div>
            </div>
        </div>

        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
                <p className="text-emerald-800 font-medium">তথ্য লোড হচ্ছে...</p>
            </div>
        ) : filteredDonors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDonors.map(donor => (
              <DonorCard 
                key={donor.id} 
                donor={donor} 
                onNameClick={(d) => {
                  if (userRole === 'admin' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL) {
                    setEditingDonor(d);
                    setShowAdmin(true);
                  } else if (currentUser) {
                    setSelectedDonorForRequest(d);
                  } else {
                    setShowAuth(true);
                  }
                }}
                canEdit={userRole === 'admin' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL}
                onEdit={(d) => {
                  setEditingDonor(d);
                  setShowAdmin(true);
                }}
                onRecordDonation={currentUser ? (d) => setSelectedDonorForDonation(d) : undefined}
                onCall={handleInitiateCall}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-gray-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Droplet size={32} className="text-gray-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-600 dark:text-slate-400 mb-2">কোনো তথ্য পাওয়া যায়নি</h3>
            <p className="text-gray-500 dark:text-slate-500">দুঃখিত, এই গ্রুপের কোনো রক্তদাতা বর্তমানে তালিকায় নেই।</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#004d38] dark:bg-black text-emerald-100 py-6 text-center relative overflow-hidden transition-colors duration-300">
        <div className="container mx-auto px-4 relative z-10">
           <div className="flex justify-center mb-3">
             {/* Footer Logo */}
             <div className="h-12 w-12 flex items-center justify-center">
                <ShishirLogo className="h-full w-full opacity-90" />
             </div>
           </div>
           <p className="mb-1 font-bold text-white text-lg">শিশির স্বেচ্ছাসেবী সংগঠন</p>
           <p className="text-emerald-300 mb-4 text-xs">মানুষের সেবায় সর্বদা নিয়োজিত</p>
           
           <div className="flex justify-center gap-4 mb-6">
             <a href="https://www.facebook.com/shishirvolunteers" target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center">
                ফেসবুক পেজ
             </a>
           </div>

           <p className="opacity-40 text-[10px] border-t border-emerald-800 pt-4">&copy; {new Date().getFullYear()} Shishir Volunteers. All rights reserved.</p>
        </div>
      </footer>

      {/* Floating Add Donor Button (All Logged-in Users) */}
      {currentUser && (
        <button 
          onClick={() => {
            setAdminInitialIsAdding(true);
            setShowAdmin(true);
          }}
          className="fixed bottom-6 right-6 z-50 bg-red-600 text-white p-4 rounded-full shadow-2xl hover:bg-red-700 transition-all transform hover:scale-110 active:scale-95 flex items-center gap-2 group"
          title="নতুন ডোনার যোগ করুন"
        >
          <Plus size={24} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">
            নতুন ডোনার যোগ করুন
          </span>
        </button>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-emerald-50 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
              <Phone size={24} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">সিস্টেম মেসেজ</h3>
            </div>
            <p className="text-gray-600 dark:text-slate-400 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{customAlert}</p>
            <button 
              onClick={() => setCustomAlert(null)} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {/* Active Call Interface */}
      {activeCall && (
        <CallInterface 
          phoneNumber={activeCall.number} 
          donorName={activeCall.name} 
          alreadyAgreed={activeCall.alreadyAgreed}
          onEndCall={() => setActiveCall(null)} 
          onDonorAgreed={() => {
            if (activeCall.donorId) {
              handleDonorAgreed(activeCall.donorId);
            }
          }}
          onDonorRefused={(reason) => {
            if (activeCall.donorId) {
              handleDonorRefused(activeCall.donorId, reason);
            }
          }}
        />
      )}

      {/* Call Warning Modal */}
      {callWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6 border border-emerald-50 dark:border-slate-800">
            <div className="bg-amber-50 dark:bg-amber-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <PhoneCall size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">ইতিমধ্যেই যোগাযোগ করা হয়েছে</h3>
              <p className="text-gray-600 dark:text-slate-400">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{callWarning.callerName}</span> ইতিমধ্যেই এই ডোনারের সাথে যোগাযোগ করেছেন এবং ডোনার রক্ত দিতে রাজি হয়েছেন।
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-500">আপনি কি তবুও কল করতে চান?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  const donor = callWarning.donor;
                  setCallWarning(null);
                  handleInitiateCall(donor, true);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95"
              >
                হ্যাঁ, কল করুন
              </button>
              <button 
                onClick={() => setCallWarning(null)} 
                className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl transition-all active:scale-95"
              >
                না, থাক
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refusal Warning Modal */}
      {refusalWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6 border border-red-50 dark:border-red-900/20 transition-colors duration-300">
            <div className="bg-red-50 dark:bg-red-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
              <PhoneCall size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">সতর্কবার্তা</h3>
              <p className="text-gray-600 dark:text-slate-400">
                এই ডোনার গত <span className="font-bold text-red-600 dark:text-red-400">{new Date(refusalWarning.date).toLocaleDateString('bn-BD')}</span> তারিখে রক্ত দিতে রাজি হননি।
              </p>
              <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl text-left border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 dark:text-slate-500 font-bold uppercase mb-1">অসম্মতির কারণ:</p>
                <p className="text-gray-700 dark:text-slate-300 italic">"{refusalWarning.reason}"</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-500">আপনি কি তবুও কল করতে চান?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  const donor = refusalWarning.donor;
                  setRefusalWarning(null);
                  handleInitiateCall(donor, true);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95"
              >
                হ্যাঁ, কল করুন
              </button>
              <button 
                onClick={() => setRefusalWarning(null)} 
                className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl transition-all active:scale-95"
              >
                না, থাক
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
      </div>
    </ErrorBoundary>
  );
};

export default App;