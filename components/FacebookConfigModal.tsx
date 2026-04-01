import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2, Facebook, Key } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface FacebookConfigModalProps {
  onClose: () => void;
}

const FacebookConfigModal: React.FC<FacebookConfigModalProps> = ({ onClose }) => {
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [pageId, setPageId] = useState('');
  
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
        const docRef = doc(db, 'settings', 'facebookConfig');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPageAccessToken(data.pageAccessToken || '');
          setPageId(data.pageId || '');
        }
      } catch (error) {
        console.error("Error fetching Facebook config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPassword === 'BASIPDB') { // Using the same password for simplicity as requested by the app structure
      setIsUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setEnteredPassword('');
    }
  };

  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    if (!pageAccessToken || !pageId) {
      setMessage({ text: 'টোকেন এবং পেজ আইডি উভয়ই প্রয়োজন।', type: 'error' });
      return;
    }
    
    setTesting(true);
    setMessage(null);
    
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}?fields=name&access_token=${pageAccessToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      setMessage({ text: `সফল! পেজ নাম: ${data.name}`, type: 'success' });
    } catch (error: any) {
      console.error("Test connection error:", error);
      setMessage({ text: `কানেকশন ফেইল: ${error.message}`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, 'settings', 'facebookConfig');
      await setDoc(docRef, {
        pageAccessToken,
        pageId,
        updatedAt: new Date().toISOString()
      });
      
      setMessage({ text: 'ফেসবুক কনফিগারেশন সফলভাবে সেভ হয়েছে!', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/facebookConfig');
      setMessage({ text: 'সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[70] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 dark:bg-slate-900 p-6 text-white flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Facebook size={28} className="text-blue-100" />
          ফেসবুক পেজ কনফিগারেশন
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
              <div className="bg-blue-100 dark:bg-blue-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                <Shield size={48} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">অ্যাক্সেস ভেরিফিকেশন</h3>
                <p className="text-slate-500 dark:text-slate-400">ফেসবুক টোকেন চেক করার জন্য পাসওয়ার্ড দিন</p>
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
                    className={`w-full px-6 py-4 rounded-2xl border-2 ${passwordError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center text-2xl tracking-widest`}
                    placeholder="••••••••"
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500 font-bold mt-2">ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  ভেরিফাই করুন
                </button>
              </form>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-blue-600" size={48} />
              <p className="text-slate-500 font-medium">লোড হচ্ছে...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-800 space-y-8">
              {message && (
                <div className={`p-4 rounded-2xl text-base font-bold animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-2 border-red-100 dark:border-red-900/30'}`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Page Access Token</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-4 text-slate-400" size={20} />
                    <textarea
                      required
                      rows={4}
                      value={pageAccessToken}
                      onChange={(e) => setPageAccessToken(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-lg resize-none"
                      placeholder="EAAG..."
                    />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    এই টোকেনটি ব্যবহার করে সরাসরি অ্যাপ থেকে ফেসবুক পেজে পোস্ট করা হবে।
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Facebook Page ID</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Key className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-lg"
                      placeholder="1234567890..."
                    />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    API Polling এর জন্য পেজ আইডি প্রয়োজন।
                  </p>
                </div>
              </div>

              <div className="pt-6 flex flex-col md:flex-row gap-4">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testing || saving}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-lg border-2 border-slate-200 dark:border-slate-700"
                >
                  {testing ? <Loader2 className="animate-spin" size={20} /> : <Facebook size={20} />}
                  {testing ? 'টেস্ট হচ্ছে...' : 'কানেকশন টেস্ট করুন'}
                </button>
                
                <button
                  type="submit"
                  disabled={saving || testing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-lg transform hover:scale-[1.01] active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
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

export default FacebookConfigModal;
