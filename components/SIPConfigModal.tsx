import React, { useState, useEffect } from 'react';
import { X, Save, Server, Shield, Loader2, PhoneCall } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface SIPConfigModalProps {
  onClose: () => void;
}

const SIPConfigModal: React.FC<SIPConfigModalProps> = ({ onClose }) => {
  const [domain, setDomain] = useState('');
  const [proxy, setProxy] = useState('');
  const [port, setPort] = useState('5060');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Password protection states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'sipConfig');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDomain(data.domain || '');
          setProxy(data.proxy || '');
          setPort(data.port || '5060');
          setUsername(data.username || '');
          setPassword(data.password || '');
        }
      } catch (error) {
        console.error("Error fetching SIP config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPassword === 'BASIPDB') {
      setIsUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setEnteredPassword('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, 'settings', 'sipConfig');
      await setDoc(docRef, {
        domain,
        proxy,
        port,
        username,
        password,
        updatedAt: new Date().toISOString()
      });
      
      // Trigger mock simulation in web browser
      // @ts-ignore
      if (typeof window !== 'undefined' && window.simulateAndroidSipConnection) {
        // @ts-ignore
        window.simulateAndroidSipConnection();
      }

      setMessage({ text: 'SIP কনফিগারেশন সফলভাবে সেভ হয়েছে!', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/sipConfig');
      setMessage({ text: 'সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="bg-indigo-900 dark:bg-slate-950 p-5 text-white flex justify-between items-center transition-colors duration-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <PhoneCall size={20} className="text-indigo-400" />
            SIP কলিং কনফিগারেশন
          </h2>
          <button onClick={onClose} className="p-1.5 bg-indigo-800/50 hover:bg-indigo-700 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {!isUnlocked ? (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">অ্যাক্সেস ভেরিফিকেশন</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">SIP অ্যাকাউন্ট চেক করার জন্য পাসওয়ার্ড দিন</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">পাসওয়ার্ড</label>
                <input
                  type="password"
                  autoFocus
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl border ${passwordError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-900/20' : 'border-gray-200 dark:border-slate-700'} bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center text-lg tracking-widest`}
                  placeholder="••••••••"
                />
                {passwordError && (
                  <p className="text-xs text-red-500 font-bold text-center mt-1">ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
              >
                ভেরিফাই করুন
              </button>
            </form>
          </div>
        ) : loading ? (
          <div className="p-10 flex justify-center items-center">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">SIP Domain / Server</label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="sip.example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">SIP Proxy (Optional)</label>
                <input
                  type="text"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="proxy.example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                <input
                  type="text"
                  required
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="5060"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">SIP Username / Extension</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="1001"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">SIP Password</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SIPConfigModal;
