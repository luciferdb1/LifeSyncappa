import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Save, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';

interface GoogleSheetsConfigModalProps {
  onClose: () => void;
}

const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({ onClose }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'googleSheetsConfig'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWebhookUrl(data.webhookUrl || '');
      }
    } catch (error) {
      console.error("Error fetching Google Sheets config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, 'settings', 'googleSheetsConfig'), {
        webhookUrl
      });
      setMessage({ text: 'Google Sheets synchronization configured successfully!', type: 'success' });
    } catch (error) {
      console.error("Error saving config:", error);
      setMessage({ text: 'Error saving configuration. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 p-4 shrink-0 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-2">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <FileSpreadsheet size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">Google Sheets Config</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-900/30 text-sm text-green-800 dark:text-green-200">
                <p className="font-bold mb-2">How to set up:</p>
                <ol className="list-decimal pl-4 space-y-2">
                    <li>Create a new Google Sheet.</li>
                    <li>Go to Extensions &gt; Apps Script.</li>
                    <li>Paste the Apps Script code (provided in documentation) to handle `doPost(e)`.</li>
                    <li>Click Deploy &gt; New Deployment. Select "Web App". Keep access as "Anyone".</li>
                    <li>Copy the "Web app URL" and paste it below.</li>
                </ol>
            </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-green-500" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium text-sm"
                  />
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'} border`}>
                  {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  <p className="text-sm font-bold">{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save Configuration
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetsConfigModal;
