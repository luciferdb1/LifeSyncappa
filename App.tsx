import React, { useState, useEffect } from 'react';
import './index.css';
import { Droplet, Search, Shield, Lock, Menu, Phone, Loader2, Database, CheckCircle2, LogOut, User as UserIcon, Users, ClipboardList, Plus, Mail, Trophy, X, PhoneCall, Home, Moon, Sun, ShieldAlert, Award } from 'lucide-react';
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
import AddDonorModal from './components/AddDonorModal';
import CallInterface from './components/CallInterface';
import SOSNotification from './components/SOSNotification';
import { logActivity } from './services/logService';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User, sendEmailVerification } from 'firebase/auth';
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';


const App: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'president' | 'secretary' | 'media' | 'volunteer' | 'editor' | 'user' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'admin' | 'profile' | 'auth' | 'addDonor' | 'request' | 'record'>('home');
  const [adminInitialView, setAdminInitialView] = useState<'menu' | 'users' | 'requests' | 'calls' | 'leaderboard' | 'followups' | 'facebookMessaging' | 'addDonor' | 'editDonor' | 'sipConfig' | 'smtpConfig' | 'facebookConfig' | 'settingsMenu'>('menu');
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [selectedDonorForRequest, setSelectedDonorForRequest] = useState<Donor | null>(null);
  const [selectedDonorForDonation, setSelectedDonorForDonation] = useState<Donor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{number: string, name: string, donorId: string, alreadyAgreed: boolean} | null>(null);
  const [callWarning, setCallWarning] = useState<{donor: Donor, callerName: string} | null>(null);
  const [refusalWarning, setRefusalWarning] = useState<{donor: Donor, reason: string, date: string} | null>(null);
  const [hasShownFollowUpAlert, setHasShownFollowUpAlert] = useState(false);
  const [followUpCount, setFollowUpCount] = useState<number>(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [sipStatus, setSipStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const mainScrollRef = React.useRef<HTMLDivElement>(null);
  const savedScrollPosition = React.useRef<number>(0);

  useEffect(() => {
    if (activeView === 'home') {
      // Restore scroll position when returning to home view
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = savedScrollPosition.current;
      }
    } else {
      // Save scroll position when leaving home view
      if (mainScrollRef.current) {
        savedScrollPosition.current = mainScrollRef.current.scrollTop;
      }
    }
  }, [activeView]);

  useEffect(() => {
    // Expose function for Android app to update SIP status
    // @ts-ignore
    window.updateSipStatus = (status: string) => {
      if (['connecting', 'connected', 'disconnected'].includes(status)) {
        setSipStatus(status as any);
      }
    };
    return () => {
      // @ts-ignore
      delete window.updateSipStatus;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        convincedByName: userProfile?.displayName || currentUser.displayName || 'Editor'
      });

      // Log activity only when agreed
      const donorSnap = await getDoc(donorRef);
      const donorData = donorSnap.data() as Donor;
      await logActivity(donorId, 'call', donorData.name, 'Agreed to donate blood after calling');

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().role === 'volunteer') {
        await updateDoc(userRef, {
          points: increment(5),
          pointsFromConvinced: increment(5)
        });
        setCustomAlert("Congratulations! You earned 5 points.");
      } else {
        setCustomAlert("Donor successfully recorded as willing to donate.");
      }
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
      setCustomAlert("Information saved successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donorId}`);
    }
  };

  const handleInitiateCall = (donor: Donor, force: boolean = false) => {
    if (!currentUser) {
      setActiveView('auth');
      return;
    }

    if (!force) {
      // Check if donor is already convinced by someone else
      if (donor.agreedToDonate && donor.convincedByUid && donor.convincedByUid !== currentUser.uid) {
        setCallWarning({ donor, callerName: donor.convincedByName || 'Another editor' });
        return;
      }

      // Check for recent refusal (within 7 days)
      if (donor.lastRefusalDate) {
        const refusalDate = new Date(donor.lastRefusalDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - refusalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7) {
          setRefusalWarning({ donor, reason: donor.lastRefusalReason || 'No reason specified', date: donor.lastRefusalDate });
          return;
        }
      }
    }

    // Otherwise, proceed with call
    // @ts-ignore
    if (window.Android && window.Android.makeSipCall) {
      const callerUid = currentUser.uid;
      const callerName = userProfile?.displayName || currentUser.displayName || 'Unknown User';
      // @ts-ignore
      window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
      setActiveCall({ number: donor.phone, name: donor.name, donorId: donor.id, alreadyAgreed: !!donor.agreedToDonate });
    } else {
      setCustomAlert("SIP calling is only supported from the Android app. Please use the app.");
    }
  };
  // SIP Connection Simulation - only for admins/staff
  useEffect(() => {
    if (typeof window !== 'undefined' && userRole && (userRole !== 'user')) {
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
        setActiveView('home');
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
    // Also check email verified so they are fully authenticated
    if (!currentUser || (currentUser && !currentUser.emailVerified)) {
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
    }, (error: any) => {
      // It's possible rules block if email not verified in some edge cases, 
      // but if we are here, we handle the error cleanly.
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
         handleFirestoreError(error, OperationType.LIST, 'donors');
      } else {
         console.error("Firestore permission denied for donors list:", error.message);
      }
      setDonors([]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Filter and Sort Logic
  useEffect(() => {
    let result = [...donors];

    // Filter by group
    if (selectedGroup) {
      result = result.filter(d => d.bloodGroup === selectedGroup);
    }
    
    // Filter by search term (name or location)
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(d => 
        (d.name && d.name.toLowerCase().includes(lowerSearch)) || 
        (d.location && d.location.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort: Available donors first
    result.sort((a, b) => {
      // First try to check strictly availability based on eligibility (120 days)
      const aEligible = isDonorEligible(a);
      const bEligible = isDonorEligible(b);
      
      if (aEligible && !bEligible) return -1;
      if (!aEligible && bEligible) return 1;
      
      // If same eligibility, sort by isAvailable boolean
      if (a.isAvailable === b.isAvailable) return 0;
      return a.isAvailable ? -1 : 1;
    });

    setFilteredDonors(result);
  }, [selectedGroup, searchTerm, donors]);

  useEffect(() => {
    if (userRole === 'admin' && donors.length > 0 && donors !== INITIAL_DONORS) {
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
      
      if (count > 0) {
        setFollowUpCount(count);
        if (!hasShownFollowUpAlert) {
          setCustomAlert(`You have ${count} follow-up calls remaining. Please contact donors from the "Follow-up Calls" option in the Admin Panel.`);
          setHasShownFollowUpAlert(true);
        } else {
          setCustomAlert(prev => prev?.includes('follow-up calls remaining') ? `You have ${count} follow-up calls remaining. Please contact donors from the "Follow-up Calls" option in the Admin Panel.` : prev);
        }
      } else if (count === 0 && hasShownFollowUpAlert) {
        setHasShownFollowUpAlert(false);
        setFollowUpCount(0);
        setCustomAlert(prev => prev?.includes('follow-up calls remaining') ? null : prev);
      } else if (count === 0 && followUpCount > 0) {
        setFollowUpCount(0);
      }
    }
  }, [userRole, donors, hasShownFollowUpAlert, followUpCount]); // Run when userRole or donors change

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isDonorEligible = (donor: Donor) => {
    if (!donor.lastDonationDate || donor.lastDonationDate === "") return true;
    
    const lastDate = new Date(donor.lastDonationDate);
    if (isNaN(lastDate.getTime())) return true;

    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 120;
  };

  const readyToDonateCount = filteredDonors.filter(isDonorEligible).length;

  return (
    <ErrorBoundary>
      <div className={`h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden ${(activeView === 'home' || activeView === 'admin' || activeView === 'profile') ? 'pt-16 md:pt-20 pb-16 md:pb-0' : ''}`}>
        {/* Background Blobs */}
        {activeView === 'home' && (
          <>
            <div className="bg-blob blob-green" />
            <div className="bg-blob blob-red" />
          </>
        )}
        
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
        
        {/* Navbar */}
        {(activeView === 'home' || activeView === 'admin' || activeView === 'profile') && (
          <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 border-b border-emerald-100/50 dark:border-slate-800/50 transition-colors duration-300">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16 md:h-20">
              {/* Left: Logo and Title */}
              <div 
                className="flex items-center gap-2 md:gap-3 cursor-pointer group" 
                onClick={() => {
                  setSelectedGroup('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div className="h-10 w-10 md:h-12 md:w-12 relative flex-shrink-0 transition-transform group-hover:scale-110 duration-500">
                    <img src="/logo.png" alt="Shishir Logo" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col relative">
                   <h1 className="text-lg md:text-2xl font-black text-emerald-900 dark:text-emerald-400 leading-none font-outfit tracking-tight">Shishir</h1>
                   <p className="text-[9px] md:text-[10px] text-red-600 dark:text-red-400 font-black tracking-[0.2em] uppercase mt-0.5">Voluntary Organization</p>
                   <div className="absolute -bottom-2 -left-2 w-[120%] h-3 pointer-events-none opacity-50">
                     <svg width="100%" height="100%" viewBox="0 0 120 20" preserveAspectRatio="none">
                       <polyline 
                         points={sipStatus === 'connected' ? "0,10 40,10 45,5 50,20 55,0 60,15 65,10 120,10" : "0,10 120,10"} 
                         fill="none" 
                         stroke="currentColor" 
                         strokeWidth="2" 
                         strokeLinecap="round" 
                         strokeLinejoin="round" 
                         className="text-red-500 drop-shadow-sm"
                         style={{
                           strokeDasharray: sipStatus === 'connected' ? 200 : 0,
                           strokeDashoffset: sipStatus === 'connected' ? 200 : 0,
                           animation: sipStatus === 'connected' ? "dashpulse 2s linear infinite" : "none"
                         }}
                       />
                     </svg>
                   </div>
                   <style>
                     {`
                       @keyframes dashpulse {
                         0% { stroke-dashoffset: 200; opacity: 0; }
                         15% { opacity: 1; }
                         85% { opacity: 1; }
                         100% { stroke-dashoffset: -200; opacity: 0; }
                       }
                     `}
                   </style>
                </div>
              </div>

              {/* Center: Navigation Links (Desktop) */}
              <div className="hidden md:flex items-center gap-8 lg:gap-12">
                <button 
                  onClick={() => {
                    setSelectedGroup('');
                    setActiveView('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`relative py-2 text-sm font-black uppercase tracking-widest transition-all group ${activeView === 'home' && !selectedGroup ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                >
                  <span className="flex items-center gap-2">
                    <Home size={18} />
                    <span>Home</span>
                  </span>
                  {activeView === 'home' && !selectedGroup && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
                  )}
                </button>
                
                {(userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' || userRole === 'volunteer' || userRole === 'editor' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL) && (
                  <button 
                    onClick={() => {
                      if (userRole !== 'admin') {
                        setAdminInitialView('leaderboard');
                      } else {
                        setAdminInitialView('menu');
                      }
                      setActiveView('admin');
                    }}
                    className={`relative py-2 text-sm font-black uppercase tracking-widest transition-all group ${activeView === 'admin' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                  >
                    <span className="flex items-center gap-2">
                       {userRole === 'admin' ? <Shield size={18} /> : <Award size={18} />}
                      <span>{userRole === 'admin' ? 'Admin Panel' : 'Staff Menu'}</span>
                    </span>
                    {activeView === 'admin' && (
                      <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* Right: User Actions */}
              <div className="flex items-center gap-3 md:gap-6">
                {isOffline && (
                  <div className="hidden sm:flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-800/50">
                    <ShieldAlert size={14} />
                    <span>Offline</span>
                  </div>
                )}
                {/* Dark Mode Toggle */}
                <button 
                  onClick={toggleDarkMode}
                  className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all duration-300 active:scale-90"
                  title={isDarkMode ? "Light Mode" : "Dark Mode"}
                >
                  {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                </button>

                <div className="hidden md:flex items-center">
                  {currentUser ? (
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setActiveView('profile')}
                        className={`p-2 rounded-2xl transition-all ${activeView === 'profile' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title="My Profile"
                      >
                        {currentUser.photoURL || userProfile?.photoUrl ? (
                          <img src={currentUser.photoURL || userProfile?.photoUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <UserIcon size={22} className="m-1" />
                        )}
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-700 transition-all px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95"
                      >
                        <LogOut size={16} />
                        <span className="hidden lg:inline">Logout</span>
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setActiveView('auth')}
                      className="flex items-center gap-2 text-white bg-emerald-600 hover:bg-emerald-700 transition-all px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      <Lock size={16} />
                      <span>Login</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

        {/* Bottom Navigation Bar (Mobile) */}
        {currentUser && (activeView === 'home' || activeView === 'admin' || activeView === 'profile') && (
          <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
            <div className="glass-panel rounded-2xl px-2 py-2 flex justify-around items-center border border-slate-200 dark:border-white/10 shadow-2xl">
              {/* Profile */}
              <button 
                onClick={() => setActiveView('profile')}
                className={`flex flex-col items-center justify-center w-16 py-2 rounded-xl transition-all ${activeView === 'profile' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
              >
                {currentUser?.photoURL || userProfile?.photoUrl ? (
                  <img src={currentUser.photoURL || userProfile?.photoUrl!} alt="Profile" className="w-6 h-6 rounded-full object-cover mb-0.5" />
                ) : (
                  <UserIcon size={20} />
                )}
                <span className="text-[9px] font-black uppercase tracking-widest mt-1">Profile</span>
              </button>

              {/* Home (Center) */}
              <button 
                onClick={() => {
                  setSelectedGroup('');
                  setActiveView('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl shadow-lg transition-all border active:scale-90 ${activeView === 'home' ? 'bg-emerald-600 text-white shadow-emerald-500/20 border-emerald-500/30' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
              >
                <Home size={24} />
              </button>

              {/* Admin / Leaderboard */}
              {(userRole === 'admin' || userRole === 'president' || userRole === 'secretary' || userRole === 'media' || userRole === 'volunteer' || userRole === 'editor' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL) ? (
                <button 
                  onClick={() => {
                    if (['admin', 'media', 'president', 'secretary'].includes(userRole || '')) {
                      setAdminInitialView('menu');
                    } else {
                      setAdminInitialView('leaderboard');
                    }
                    setActiveView('admin');
                  }}
                  className={`flex flex-col items-center justify-center w-16 py-2 rounded-xl transition-all ${activeView === 'admin' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                >
                  {userRole === 'admin' ? <Shield size={20} /> : <Award size={20} />}
                  <span className="text-[9px] font-black uppercase tracking-widest mt-1">{userRole === 'admin' ? 'Admin' : (userRole === 'media' ? 'Media' : 'Staff')}</span>
                </button>
              ) : (
                <div className="w-16"></div>
              )}
            </div>
          </nav>
        )}

      {currentUser && activeView === 'home' && (
        <div className="fixed bottom-24 right-8 z-40 flex flex-col gap-4">
          {showScrollTop && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-12 h-12 bg-white/90 dark:bg-slate-800/90 text-emerald-600 dark:text-emerald-400 rounded-full shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] flex items-center justify-center border-2 border-emerald-100 dark:border-emerald-900 mx-auto"
              title="Back to Top"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
            </motion.button>
          )}
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveView('addDonor')}
            className="w-16 h-16 bg-emerald-600 text-white rounded-full shadow-[0_12px_40px_-8px_rgba(5,150,105,0.4)] flex items-center justify-center border-4 border-white group overflow-hidden"
            title="Add New Donor"
          >
            <Plus size={32} className="relative z-10" />
          </motion.button>
        </div>
      )}


      {/* Email Verification Overlay */}
      {currentUser && !currentUser.emailVerified && (
        <div className="fixed inset-0 bg-slate-900/80 dark:bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl shadow-2xl p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-red-50 dark:bg-red-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
              <Mail size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Email</h2>
              <p className="text-gray-600 dark:text-slate-400">
                Email verification is required to activate your account. We have sent a link to <b>{currentUser.email}</b>.
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-2xl text-sm text-amber-800 dark:text-amber-400 text-left flex gap-3">
              <Shield size={20} className="shrink-0 mt-0.5" />
              <p>Without verification, you cannot view information or contact donors.</p>
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
                Verified (Refresh)
              </button>
              <button 
                onClick={async () => {
                  try {
                    await sendEmailVerification(currentUser);
                    alert("Verification email resent.");
                  } catch (e: any) {
                    alert("Error: " + e.message);
                  }
                }}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold text-sm"
              >
                Didn't get the link? Resend
              </button>
              <button 
                onClick={handleLogout}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuthLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 transition-colors duration-300 relative">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full blur-xl bg-emerald-300/30 dark:bg-emerald-400/20 animate-pulse"></div>
            <img src="/logo.png" alt="Shishir Logo" className="h-28 w-28 object-contain drop-shadow-2xl relative z-10 animate-pulse transition-all duration-1000 mx-auto" />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-8 flex items-center justify-center opacity-70">
              <svg width="120" height="20" viewBox="0 0 120 20" className="w-full h-full overflow-hidden">
                <polyline 
                  points="0,10 40,10 45,5 50,20 55,0 60,15 65,10 120,10" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-emerald-500 drop-shadow-md"
                  style={{
                    strokeDasharray: 200,
                    strokeDashoffset: 200,
                    animation: "dash 2s linear infinite"
                  }}
                />
              </svg>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold tracking-widest text-sm"
          >
            <span>CONNECTING...</span>
          </motion.div>
        </div>
      ) : !currentUser ? (
        isOffline ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center transition-colors duration-300">
            <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full space-y-6 border border-slate-100 dark:border-slate-800">
              <div className="bg-red-50 dark:bg-red-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <ShieldAlert className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No Internet Connection</h2>
                <p className="text-gray-600 dark:text-slate-400 font-medium">
                  Internet connection is required to login. Please turn on your internet connection and try again.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Auth onClose={() => {}} isClosable={false} />
        )
      ) : userRole === 'user' && currentUser.email?.toLowerCase() !== MAIN_ADMIN_EMAIL ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center transition-colors duration-300">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-500 border border-slate-100 dark:border-slate-800 transition-colors duration-300">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <img src="/logo.png" alt="Shishir Logo" className="h-14 w-14 object-contain" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Access Restricted</h2>
              <p className="text-gray-600 dark:text-slate-400 font-medium">
                Please contact Shishir Voluntary Organization to use the app.
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-4 rounded-2xl text-sm text-emerald-800 dark:text-emerald-400 flex flex-col items-center gap-2">
              <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
              <p>Your account is currently pending approval.</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {activeView === 'admin' && currentUser && (
            <AdminPanel 
              onClose={() => {
                setActiveView('home');
                setAdminInitialView('menu');
                setEditingDonor(null);
              }} 
              userRole={userRole}
              initialView={adminInitialView}
              initialEditingDonor={editingDonor}
            />
          )}
          {activeView === 'profile' && (
            <Profile 
              userProfile={userProfile}
              onClose={() => setActiveView('home')}
            />
          )}
          {activeView === 'auth' && (
            <Auth onClose={() => setActiveView('home')} />
          )}
          {activeView === 'addDonor' && (
            <AddDonorModal 
              onClose={() => setActiveView('home')} 
              onAdd={() => setActiveView('home')} 
            />
          )}
          {activeView === 'request' && selectedDonorForRequest && (
            <RequestModal 
              donor={selectedDonorForRequest} 
              onClose={() => {
                setSelectedDonorForRequest(null);
                setActiveView('home');
              }} 
            />
          )}
          {activeView === 'record' && selectedDonorForDonation && (
            <RecordDonationModal 
              donor={selectedDonorForDonation} 
              userRole={userRole}
              onClose={() => {
                setSelectedDonorForDonation(null);
                setActiveView('home');
              }} 
            />
          )}
          
          <div 
            ref={mainScrollRef}
            onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 300)}
            className={`flex-1 overflow-y-auto no-scrollbar relative scroll-smooth w-full ${activeView === 'home' ? 'flex flex-col block' : 'hidden'}`}
          >
              {/* Hero Section */}
              <div className="bg-[#006a4e] dark:bg-slate-950 text-white py-8 md:py-10 px-4 text-center relative overflow-hidden transition-colors duration-300 shrink-0">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600 rounded-full opacity-20 blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500 rounded-full opacity-10 blur-3xl"></div>
                  <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg opacity-5" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FFFFFF" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.9C87.4,-34.7,90.1,-20.4,85.8,-8.3C81.5,3.8,70.2,13.7,60.8,24.6C51.4,35.5,43.9,47.4,34,56.1C24.1,64.8,11.8,70.3,-1.2,72.4C-14.2,74.5,-29.3,73.2,-42,65.6C-54.7,58,-65,44.1,-71.5,29.1C-78,14.1,-80.7,-2,-77.4,-16.8C-74.1,-31.6,-64.8,-45.1,-52.7,-53.1C-40.6,-61.1,-25.7,-63.6,-11.3,-65.5C3.1,-67.4,17.5,-68.7,30.5,-83.6L44.7,-76.4Z" transform="translate(100 100)" />
                  </svg>
                </div>
                
                <div className="relative z-10 max-w-3xl mx-auto mt-2">
                  {/* Search Box */}
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-xl max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center transform transition-all duration-300 border border-emerald-100/20 dark:border-slate-800 gap-2">
                    {/* Text Search */}
                    <div className="flex-1 flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <Search size={18} className="text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search donor by name or location..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400"
                        />
                    </div>
                    {/* Divider */}
                    <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                    {/* Blood Group Filter */}
                    <div className="flex items-center px-2 py-1">
                        <div className="pl-1">
                          <label className="block text-[10px] text-left text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-1 mb-0.5">Blood Group</label>
                          <select 
                            value={selectedGroup}
                            onChange={(e) => setSelectedGroup(e.target.value)}
                            className="bg-transparent outline-none font-black text-emerald-800 dark:text-emerald-400 cursor-pointer appearance-none px-1"
                          >
                            <option value="" className="dark:bg-slate-900">All Groups</option>
                            {BLOOD_GROUPS_LIST.map(bg => (
                              <option key={bg} value={bg} className="dark:bg-slate-900">{bg}</option>
                            ))}
                          </select>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-2 ml-3">
                            <Droplet className="text-red-500 dark:text-red-400" size={18} />
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Section */}
              <div className="container mx-auto px-4 py-8 -mt-6 relative z-20 shrink-0">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-emerald-100 dark:border-slate-800 p-4 mb-6">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-400 flex items-center">
                            <span className="w-1.5 h-6 bg-red-500 rounded-full mr-2"></span>
                            {selectedGroup ? `${selectedGroup} Blood Donors` : 'All Donors'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/30">
                                Total Donors: <span className="font-black">{filteredDonors.length}</span>
                            </span>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                Ready: <span className="font-black">{readyToDonateCount}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
                        <p className="text-emerald-800 font-medium">Loading data...</p>
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
                            setAdminInitialView('editDonor');
                            setActiveView('admin');
                          } else if (currentUser) {
                            setSelectedDonorForRequest(d);
                            setActiveView('request');
                          } else {
                            setActiveView('auth');
                          }
                        }}
                        canEdit={userRole === 'admin' || currentUser?.email?.toLowerCase() === MAIN_ADMIN_EMAIL}
                        onEdit={(d) => {
                          setEditingDonor(d);
                          setAdminInitialView('editDonor');
                          setActiveView('admin');
                        }}
                        onRecordDonation={currentUser ? (d) => {
                          setSelectedDonorForDonation(d);
                          setActiveView('record');
                        } : undefined}
                        onCall={handleInitiateCall}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 transition-colors duration-300">
                    <div className="bg-gray-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Droplet size={32} className="text-gray-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-600 dark:text-slate-400 mb-2">No data found</h3>
                    <p className="text-gray-500 dark:text-slate-500">Sorry, there are currently no donors for this group in the list.</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      )}
      {customAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-emerald-50 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
              <Phone size={24} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">System Message</h3>
            </div>
            <p className="text-gray-600 dark:text-slate-400 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{customAlert}</p>
            <button 
              onClick={() => setCustomAlert(null)} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors"
            >
              OK
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
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Already Contacted</h3>
              <p className="text-gray-600 dark:text-slate-400">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{callWarning.callerName}</span> has already contacted this donor and they agreed to donate.
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-500">Do you still want to call?</p>
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
                Yes, Call
              </button>
              <button 
                onClick={() => setCallWarning(null)} 
                className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl transition-all active:scale-95"
              >
                No, Cancel
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
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Warning</h3>
              <p className="text-gray-600 dark:text-slate-400">
                This donor refused to donate blood on <span className="font-bold text-red-600 dark:text-red-400">{new Date(refusalWarning.date).toLocaleDateString('en-US')}</span>.
              </p>
              <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl text-left border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 dark:text-slate-500 font-bold uppercase mb-1">Reason for Refusal:</p>
                <p className="text-gray-700 dark:text-slate-300 italic">"{refusalWarning.reason}"</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-500">Do you still want to call?</p>
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
                Yes, Call
              </button>
              <button 
                onClick={() => setRefusalWarning(null)} 
                className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl transition-all active:scale-95"
              >
                No, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <SOSNotification userRole={userRole} followUpCount={followUpCount} />
      )}
    </div>
  </ErrorBoundary>
);
};

export default App;