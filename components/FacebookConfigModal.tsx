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
      setMessage({ text: 'Token and Page ID are both required.', type: 'error' });
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
      
      setMessage({ text: `Success! Page Name: ${data.name}`, type: 'success' });
    } catch (error: any) {
      console.error("Test connection error:", error);
      setMessage({ text: `Connection Failed: ${error.message}`, type: 'error' });
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
      
      setMessage({ text: 'Facebook configuration saved successfully!', type: 'success' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/facebookConfig');
      setMessage({ text: 'Error saving configuration. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="bg-blue-600 dark:bg-slate-900 p-4 text-white flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Facebook size={24} className="text-blue-100" />
          Facebook Page Configuration
        </h2>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-90"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          {!isUnlocked ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6 text-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Shield size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Access Verification</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Enter password to check Facebook token</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm mx-auto">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-left">Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl border-2 ${passwordError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center text-xl tracking-widest`}
                    placeholder="••••••••"
                  />
                  {passwordError && (
                    <p className="text-xs text-red-500 font-bold mt-1">Incorrect password! Try again.</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-95 text-sm"
                >
                  Verify
                </button>
              </form>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-sm text-slate-500 font-medium">Loading...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
              {message && (
                <div className={`p-3 rounded-xl text-sm font-bold animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Page Access Token</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3 text-slate-400" size={18} />
                    <textarea
                      required
                      rows={3}
                      value={pageAccessToken}
                      onChange={(e) => setPageAccessToken(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                      placeholder="EAAG..."
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This token will be used to post directly to the Facebook page from the app.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Facebook Page ID</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="1234567890..."
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Page ID is required for API Polling.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col md:flex-row gap-3">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testing || saving}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm border-2 border-slate-200 dark:border-slate-700"
                >
                  {testing ? <Loader2 className="animate-spin" size={18} /> : <Facebook size={18} />}
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                
                <button
                  type="submit"
                  disabled={saving || testing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm transform hover:scale-[1.01] active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
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

export default FacebookConfigModal;
