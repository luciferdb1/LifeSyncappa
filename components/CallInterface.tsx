import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, User, Phone, Check, X, Droplet } from 'lucide-react';
import { doc } from 'firebase/firestore';

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

  // Handle global SIP status updates
  useEffect(() => {
    // @ts-ignore
    window.updateSipStatus = (newStatus: string) => {
      if (['calling', 'ringing', 'connected', 'disconnected'].includes(newStatus)) {
        if (newStatus === 'disconnected') {
          setStatus('ended');
          setTimeout(() => setShowPostCallPopup(true), 1000);
        } else {
          setStatus(newStatus as any);
        }
      }
    };
    
    return () => {
      // @ts-ignore
      delete window.updateSipStatus;
    };
  }, []);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    // @ts-ignore
    if (window.Android && window.Android.toggleMute) {
      // @ts-ignore
      window.Android.toggleMute(nextMuted);
    }
  };

  const toggleSpeaker = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeaker = !isSpeaker;
    setIsSpeaker(nextSpeaker);
    // @ts-ignore
    if (window.Android && window.Android.toggleSpeaker) {
      // @ts-ignore
      window.Android.toggleSpeaker(nextSpeaker);
    }
  };

  const handleEndCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('ended');
    // @ts-ignore
    if (window.Android && window.Android.endSipCall) {
      // @ts-ignore
      window.Android.endSipCall();
    }
    setTimeout(() => setShowPostCallPopup(true), 1000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900 flex flex-col items-center justify-between py-12 animate-in fade-in zoom-in-95 duration-300">
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
          {status === 'calling' && 'Calling...'}
          {status === 'ringing' && 'Ringing...'}
          {status === 'connected' && formatTime(duration)}
          {status === 'ended' && 'Call ended'}
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
                <span className="text-[10px] mt-1 font-bold uppercase tracking-tighter">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button 
                onClick={toggleSpeaker}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${isSpeaker ? 'bg-white text-slate-900 scale-110 shadow-lg shadow-white/20' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                <Volume2 size={24} />
                <span className="text-[10px] mt-1 font-bold uppercase tracking-tighter">Speaker</span>
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
              <h3 className="text-2xl font-bold text-gray-900">Willing to donate blood?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Has the donor agreed to donate blood?
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={async () => {
                  onDonorAgreed?.();
                  onEndCall();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Yes, agreed
              </button>
              
              <button 
                onClick={() => setShowRefusalInput(true)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <X size={20} />
                No, did not agree
              </button>

              <button 
                onClick={onEndCall}
                className="w-full mt-2 text-slate-400 hover:text-slate-600 font-bold py-3 transition-colors text-sm"
              >
                Cancel / Did not answer
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
              <h3 className="text-2xl font-bold text-gray-900">Reason for refusal</h3>
              <p className="text-gray-600">
                Briefly write why the donor did not agree.
              </p>
            </div>
            
            <textarea
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              placeholder="Write the reason..."
              className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:outline-none transition-all resize-none h-32"
            />
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (refusalReason.trim()) {
                    onDonorRefused?.(refusalReason.trim());
                    onEndCall();
                  }
                }}
                disabled={!refusalReason.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95"
              >
                Submit
              </button>
              <button 
                onClick={() => setShowRefusalInput(false)}
                className="w-full text-slate-500 font-bold py-3"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallInterface;
