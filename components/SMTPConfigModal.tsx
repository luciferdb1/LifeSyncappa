import React, { useState, useEffect } from 'react';
import { X, Save, Mail, Shield, Loader2, Server } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface SMTPConfigModalProps {
  onClose: () => void;
}

const SMTPConfigModal: React.FC<SMTPConfigModalProps> = ({ onClose }) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [secure, setSecure] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Password protection states (using the same password as SIP for simplicity or a different one)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'smtpConfig');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHost(data.host || '');
          setPort(data.port || '587');
          setUser(data.user || '');
          setPass(data.pass || '');
          setFrom(data.from || '');
          setSecure(data.secure || false);
        }
      } catch (error) {
        console.error("Error fetching SMTP config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Using a simple password for admin settings protection
    if (enteredPassword === 'BASMTPDB') {
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
      const docRef = doc(db, 'settings', 'smtpConfig');
      await setDoc(docRef, {
        host,
        port,
        user,
        pass,
        from,
        secure,
        updatedAt: new Date().toISOString()
      });
      
      setMessage({ text: 'SMTP কনফিগারেশন সফলভাবে সেভ হয়েছে!', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/smtpConfig');
      setMessage({ text: 'সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[70] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-emerald-900 dark:bg-slate-900 p-6 text-white flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Mail size={28} className="text-emerald-400" />
          SMTP ইমেইল কনফিগারেশন
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
              <div className="bg-emerald-100 dark:bg-emerald-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                <Shield size={48} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">অ্যাক্সেস ভেরিফিকেশন</h3>
                <p className="text-slate-500 dark:text-slate-400">SMTP সেটিংস পরিবর্তন করার জন্য পাসওয়ার্ড দিন</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-left">পাসওয়ার্ড</label>
                  <input
                    type="password"
                    autoFocus
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    className={`w-full px-6 py-4 rounded-2xl border-2 ${passwordError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-center text-2xl tracking-widest`}
                    placeholder="••••••••"
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500 font-bold mt-2">ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  ভেরিফাই করুন
                </button>
              </form>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-emerald-600" size={48} />
              <p className="text-slate-500 font-medium">লোড হচ্ছে...</p>
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
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SMTP Host</label>
                  <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      required
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-lg"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                  <input
                    type="text"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-lg"
                    placeholder="587"
                  />
                </div>

                <div className="flex items-center pt-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={secure}
                        onChange={(e) => setSecure(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${secure ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${secure ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SSL/TLS (Secure)</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SMTP User / Email</label>
                  <input
                    type="email"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-lg"
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SMTP Password / App Password</label>
                  <input
                    type="password"
                    required
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-lg"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">From Name & Email</label>
                  <input
                    type="text"
                    required
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-lg"
                    placeholder='"Shishir" <noreply@shishir.com>'
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-2xl shadow-2xl shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-xl transform hover:scale-[1.01] active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={28} /> : <Save size={28} />}
                  {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SMTPConfigModal;
