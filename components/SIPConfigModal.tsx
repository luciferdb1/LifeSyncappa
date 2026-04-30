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

      setMessage({ text: 'SIP configuration saved successfully!', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/sipConfig');
      setMessage({ text: 'Error saving configuration. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="bg-indigo-900 dark:bg-slate-900 p-6 text-white flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <PhoneCall size={28} className="text-indigo-400" />
          SIP Calling Configuration
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-90"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-2xl mx-auto">
          {!isUnlocked ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-800 space-y-8 text-center">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                <Shield size={48} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Access Verification</h3>
                <p className="text-slate-500 dark:text-slate-400">Enter password to check SIP account</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-left">Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    className={`w-full px-6 py-4 rounded-2xl border-2 ${passwordError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center text-2xl tracking-widest`}
                    placeholder="••••••••"
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500 font-bold mt-2">Incorrect password! Try again.</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  Verify
                </button>
              </form>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-slate-500 font-medium">Loading...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-800 space-y-8">
              {message && (
                <div className={`p-4 rounded-2xl text-base font-bold animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-2 border-red-100 dark:border-red-900/30'}`}>
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SIP Domain / Server</label>
                  <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      required
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg"
                      placeholder="sip.example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SIP Proxy (Optional)</label>
                  <input
                    type="text"
                    value={proxy}
                    onChange={(e) => setProxy(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg"
                    placeholder="proxy.example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                  <input
                    type="text"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg"
                    placeholder="5060"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SIP Username / Extension</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg"
                      placeholder="1001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SIP Password</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl shadow-2xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-xl transform hover:scale-[1.01] active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={28} /> : <Save size={28} />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>

  );
};

export default SIPConfigModal;
