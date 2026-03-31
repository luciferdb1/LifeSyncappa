import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, User, Phone, Check, X, Droplet, Loader2 } from 'lucide-react';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';

import { audioService } from '../services/audioService';

interface CallInterfaceProps {
  phoneNumber: string;
  donorName: string;
  alreadyAgreed?: boolean;
  onEndCall: () => void;
  onDonorAgreed?: () => void;
  onDonorRefused?: (reason: string) => void;
}

const CallInterface: React.FC<CallInterfaceProps> = ({ phoneNumber, donorName, alreadyAgreed, onEndCall, onDonorAgreed, onDonorRefused }) => {
  const [status, setStatus] = useState<'calling' | 'ringing' | 'connected' | 'ended'>('calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showPostCallPopup, setShowPostCallPopup] = useState(false);
  const [showRefusalInput, setShowRefusalInput] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');
  const [userData, setUserData] = useState<any | null>(null);
  const [uploadPromise, setUploadPromise] = useState<Promise<void> | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle audio playback based on call status
  useEffect(() => {
    if (status === 'calling' || status === 'ringing') {
      audioService.playRingback();
    } else if (status === 'ended') {
      audioService.playHangup();
    } else {
      audioService.stopAll();
    }

    return () => {
      audioService.stopAll();
    };
  }, [status]);

  // Function to manually trigger audio if blocked
  const handleUserInteraction = () => {
    if (status === 'calling' || status === 'ringing') {
      audioService.playRingback();
    }
  };

  useEffect(() => {
    // Fetch current user's display name
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
      });
    }
  }, []);

  useEffect(() => {
    // Simulate call progression if not on Android
    // @ts-ignore
    const isAndroid = !!(window.Android && window.Android.makeSipCall);
    
    let ringTimer: NodeJS.Timeout;
    let connectTimer: NodeJS.Timeout;

    if (!isAndroid) {
      ringTimer = setTimeout(() => setStatus('ringing'), 1500);
      connectTimer = setTimeout(() => setStatus('connected'), 4500);
    }

    // Expose status update function for Android app
    // @ts-ignore
    window.onCallStatusChanged = (newStatus: string) => {
      if (newStatus === 'ringing') setStatus('ringing');
      if (newStatus === 'connected') setStatus('connected');
      if (newStatus === 'ended') handleEndCall();
    };

    return () => {
      if (ringTimer) clearTimeout(ringTimer);
      if (connectTimer) clearTimeout(connectTimer);
      // @ts-ignore
      delete window.onCallStatusChanged;
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
      startRecording();
    } else if (status === 'ended') {
      stopRecording();
    }
    return () => {
      clearInterval(interval);
      if (status !== 'ended') stopRecording();
    };
  }, [status]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      console.log("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log("Recording stopped");
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    // @ts-ignore
    if (window.Android && window.Android.toggleMute) {
      // @ts-ignore
      window.Android.toggleMute(nextMuted);
    }
  };

  const toggleSpeaker = () => {
    const nextSpeaker = !isSpeaker;
    setIsSpeaker(nextSpeaker);
    // @ts-ignore
    if (window.Android && window.Android.toggleSpeaker) {
      // @ts-ignore
      window.Android.toggleSpeaker(nextSpeaker);
    }
  };

  const handleEndCall = async () => {
    if (status === 'ended') return;
    
    setStatus('ended');
    stopRecording();
    
    // @ts-ignore
    if (window.Android && window.Android.endSipCall) {
      // @ts-ignore
      window.Android.endSipCall();
    }

    // Save a call record if the call was connected and lasted more than 0 seconds
    if (duration > 0 && auth.currentUser) {
      const uploadTask = (async () => {
        try {
          let audioUrl = '';
          let storagePath = '';

          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const fileName = `calls/${auth.currentUser.uid}/${Date.now()}.webm`;
            const storageRef = ref(storage, fileName);
            
            const uploadResult = await uploadBytes(storageRef, audioBlob);
            audioUrl = await getDownloadURL(uploadResult.ref);
            storagePath = fileName;
          }

          const callerName = userData?.displayName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Admin';
          
          await addDoc(collection(db, 'callRecords'), {
            callerUid: auth.currentUser.uid,
            callerName: callerName,
            donorPhone: phoneNumber,
            donorName: donorName,
            audioUrl: audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Fallback if recording failed
            storagePath: storagePath || 'mock/path/record.mp3',
            timestamp: new Date().toISOString(),
            duration: duration
          });
        } catch (error) {
          console.error("Error saving call record:", error);
          handleFirestoreError(error, OperationType.CREATE, 'callRecords');
        }
      })();
      
      setUploadPromise(uploadTask);

      // Immediately show post-call popup or end call
      if (alreadyAgreed) {
        // Wait for upload if it's already agreed and we're ending immediately
        await uploadTask;
        onEndCall();
      } else {
        setShowPostCallPopup(true);
      }
    } else {
      setTimeout(() => onEndCall(), 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div 
      onClick={handleUserInteraction}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-between py-12 animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl transition-colors duration-1000 ${
          status === 'connected' ? 'bg-emerald-500/10' : status === 'ended' ? 'bg-red-500/10' : 'bg-blue-500/10'
        }`}></div>
      </div>

      <div className="flex flex-col items-center mt-16 z-10">
        <div className="relative mb-8">
          {status === 'ringing' && (
            <>
              <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
            </>
          )}
          {status === 'calling' && (
            <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-pulse"></div>
          )}
          <div className={`w-28 h-28 bg-slate-800 rounded-full flex items-center justify-center shadow-2xl border relative z-10 transition-colors duration-500 ${
            status === 'connected' ? 'border-emerald-500/50' : status === 'ended' ? 'border-red-500/50' : 'border-slate-700'
          }`}>
            <User size={56} className={status === 'connected' ? 'text-emerald-400' : status === 'ended' ? 'text-red-400' : 'text-blue-400'} />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-2 tracking-wide">{donorName}</h2>
        <p className="text-slate-400 text-lg mb-8 font-mono">{phoneNumber}</p>
        
        <div className={`px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-500 ${
          status === 'connected' ? 'bg-emerald-500/20 text-emerald-400 scale-110' : 
          status === 'ended' ? 'bg-red-500/20 text-red-400' : 
          'bg-slate-800 text-slate-400'
        }`}>
          {status === 'calling' && 'কল করা হচ্ছে...'}
          {status === 'ringing' && 'রিং হচ্ছে...'}
          {status === 'connected' && formatTime(duration)}
          {status === 'ended' && 'কল শেষ হয়েছে'}
        </div>
      </div>

      <div className="flex flex-col items-center gap-12 mb-8 w-full max-w-xs z-10">
        {status !== 'ended' && (
          <>
            <div className="flex justify-center gap-8 w-full">
              <button 
                onClick={toggleMute}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${isMuted ? 'bg-white text-slate-900 scale-110 shadow-lg shadow-white/20' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                <span className="text-[10px] mt-1 font-bold uppercase tracking-tighter">{isMuted ? 'আনমিউট' : 'মিউট'}</span>
              </button>
              <button 
                onClick={toggleSpeaker}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${isSpeaker ? 'bg-white text-slate-900 scale-110 shadow-lg shadow-white/20' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                <Volume2 size={24} />
                <span className="text-[10px] mt-1 font-bold uppercase tracking-tighter">স্পিকার</span>
              </button>
            </div>

            <button 
              onClick={handleEndCall}
              className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.5)] transition-all active:scale-90 hover:scale-105"
            >
              <PhoneOff size={32} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Post-Call Popup */}
      {showPostCallPopup && !showRefusalInput && (
        <div className="fixed inset-0 z-[210] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-emerald-600 relative">
              <Droplet size={48} fill="currentColor" className="animate-pulse" />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white">
                {formatTime(duration)}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">রক্তদানে ইচ্ছুক?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                এডিটর <span className="font-bold text-emerald-600">{userData?.displayName || auth.currentUser?.displayName || 'Editor'}</span>, ডোনার কি রক্ত দিতে রাজি হয়েছেন? রাজি হয়ে থাকলে আপনি ৫ পয়েন্ট পাবেন।
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={async () => {
                  onDonorAgreed?.();
                  if (uploadPromise) await uploadPromise;
                  onEndCall();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check size={20} />
                হ্যাঁ, রাজি হয়েছেন
              </button>
              <button 
                onClick={() => setShowRefusalInput(true)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <X size={20} />
                না, রাজি হননি
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refusal Input Popup */}
      {showRefusalInput && (
        <div className="fixed inset-0 z-[210] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600">
              <X size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">অসম্মতির কারণ</h3>
              <p className="text-gray-600">
                ডোনার কেন রাজি হননি তা সংক্ষেপে লিখুন।
              </p>
            </div>
            <textarea
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              placeholder="কারণ লিখুন..."
              className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:outline-none transition-all resize-none h-32"
            />
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (refusalReason.trim()) {
                    onDonorRefused?.(refusalReason.trim());
                    if (uploadPromise) await uploadPromise;
                    onEndCall();
                  }
                }}
                disabled={!refusalReason.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95"
              >
                সাবমিট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallInterface;
