import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { PosterSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface PosterApprovalsPanelProps {
  onClose: () => void;
}

const PosterApprovalsPanel: React.FC<PosterApprovalsPanelProps> = ({ onClose }) => {
  const [submissions, setSubmissions] = useState<PosterSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'poster_submissions'),
        where('status', '==', 'pending'),
        // we can't easily order by timestamp if not indexed with where, so we sort client side if needed
      );
      const snapshot = await getDocs(q);
      const data: PosterSubmission[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as PosterSubmission);
      });
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSubmissions(data);
    } catch (e) {
      console.error('Error fetching submissions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submission: PosterSubmission) => {
    setProcessingId(submission.id!);
    try {
      const docRef = doc(db, 'settings', 'facebookConfig');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists() || !docSnap.data().pageAccessToken || !docSnap.data().pageId) {
        alert("Facebook page token or ID is not set. Cannot approve and post.");
        setProcessingId(null);
        return;
      }
      
      const pageAccessToken = docSnap.data().pageAccessToken;
      const pageId = docSnap.data().pageId;

      const url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const response = await fetch(url + '?access_token=' + pageAccessToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
           url: submission.posterUrl,
           published: true
        })
      });

      if (response.ok) {
        // Delete completely since it is approved
        await deleteDoc(doc(db, 'poster_submissions', submission.id!));
        setSubmissions(prev => prev.filter(s => s.id !== submission.id));
      } else {
        const data = await response.json();
        alert('Failed to post to Facebook: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error approving poster');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this poster?")) return;
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'poster_submissions', id), {
        status: 'rejected'
      });
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error rejecting poster');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 p-4 shrink-0 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 relative z-10">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                <ImageIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">Poster Approvals</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-100 dark:border-slate-800">
            <ImageIcon size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No pending posters</h3>
            <p className="text-slate-500 mt-2">Volunteer poster submissions will appear here for approval.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {submissions.map((sub) => (
                <motion.div 
                  key={sub.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col"
                >
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Donor: {sub.donorName}</p>
                    <p className="text-xs text-slate-500 mt-1">Submitted by: {sub.submittedByName}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(sub.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="p-2 aspect-[4/5] bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                    <img src={sub.posterUrl} alt="Poster preview" className="max-h-full max-w-full object-contain rounded-lg shadow-sm" />
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 mt-auto">
                    <button 
                      onClick={() => handleReject(sub.id!)}
                      disabled={processingId === sub.id}
                      className="flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(sub)}
                      disabled={processingId === sub.id}
                      className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                    >
                      {processingId === sub.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      Approve
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosterApprovalsPanel;
