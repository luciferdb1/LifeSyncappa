import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, MessageSquare, Send, User, Facebook, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Participant {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface Conversation {
  id: string;
  participants: {
    data: Participant[];
  };
  updated_time: string;
  unread_count: number;
  snippet: string;
}

interface Message {
  id: string;
  message: string;
  created_time: string;
  from: {
    id: string;
    name: string;
  };
}

interface FacebookMessagingPanelProps {
  onClose: () => void;
}

const FacebookMessagingPanel: React.FC<FacebookMessagingPanelProps> = ({ onClose }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize notification sound
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    
    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const fetchConversations = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/facebook/conversations');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      if (data.data) {
        const newConversations = data.data as Conversation[];
        if (data.pageId) setPageId(data.pageId);
        
        // Check for new messages
        if (lastUpdatedTime && newConversations.length > 0) {
          const latest = newConversations[0];
          if (new Date(latest.updated_time) > new Date(lastUpdatedTime)) {
            // New message arrived!
            if (latest.unread_count > 0) {
              playNotification(latest);
            }
          }
        }
        
        setConversations(newConversations);
        if (newConversations.length > 0) {
          setLastUpdatedTime(newConversations[0].updated_time);
        }
      }
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      setError(error.message || "কনভারসেশন লোড করতে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const playNotification = (conv: Conversation) => {
    // Play sound
    if (notificationSound.current) {
      notificationSound.current.play().catch(e => console.error("Error playing sound:", e));
    }

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const participant = getParticipant(conv);
      new Notification(`নতুন মেসেজ: ${participant.name}`, {
        body: conv.snippet,
        icon: participant.picture?.data.url || '/favicon.ico'
      });
    }
  };

  const getPSID = (conv: Conversation) => {
    if (!pageId) return conv.participants.data[0].id;
    const user = conv.participants.data.find(p => p.id !== pageId);
    return user ? user.id : conv.participants.data[0].id;
  };

  const getParticipant = (conv: Conversation) => {
    if (!pageId) return conv.participants.data[0];
    const user = conv.participants.data.find(p => p.id !== pageId);
    return user || conv.participants.data[0];
  };

  const fetchMessages = async (psid: string) => {
    setIsMessagesLoading(true);
    try {
      const response = await fetch(`/api/facebook/messages/${psid}`);
      const data = await response.json();
      if (data.data) {
        // Facebook returns messages in reverse chronological order
        setMessages(data.data.reverse());
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  useEffect(() => {
    if (selectedConv) {
      const psid = getPSID(selectedConv);
      fetchMessages(psid);
      
      // Also refresh messages periodically if a conversation is selected
      const msgInterval = setInterval(() => {
        fetchMessages(psid);
      }, 5000);
      
      return () => clearInterval(msgInterval);
    }
  }, [selectedConv, pageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSending) return;

    setIsSending(true);
    const psid = getPSID(selectedConv);

    try {
      const response = await fetch('/api/facebook/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: psid,
          message: newMessage
        })
      });

      if (response.ok) {
        setNewMessage('');
        // Refresh messages
        fetchMessages(psid);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[60] flex flex-col overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse" />
              <div className="bg-emerald-500 p-3 rounded-2xl text-white relative z-10 shadow-lg shadow-emerald-200 dark:shadow-none">
                <Facebook size={28} />
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                ফেসবুক <span className="text-emerald-500">ম্যাসেজিং</span>
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                  Live Chat
                </span>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fetchConversations(true)} 
              disabled={isRefreshing}
              className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-50"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/30 dark:bg-slate-950 relative">
          {/* Sidebar: Conversations List */}
          <div className={`${selectedConv ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 border-r border-slate-100 dark:border-slate-800 flex-col bg-white dark:bg-slate-900 shadow-sm relative z-30`}>
            <div className="p-6 border-b border-slate-50 dark:border-slate-800">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">কনভারসেশনসমূহ</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-32">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">লোড হচ্ছে...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/20 mb-6">
                    <p className="text-xs text-red-600 dark:text-red-400 font-bold leading-relaxed">
                      {error.includes('expired') 
                        ? 'ফেসবুক সেশন শেষ হয়ে গেছে। অনুগ্রহ করে অ্যাডমিন প্যানেল থেকে নতুন টোকেন সেট করুন।' 
                        : error.includes('Unsupported get request')
                        ? 'ফেসবুক পেজ আইডি বা পারমিশনে সমস্যা আছে। অনুগ্রহ করে কনফিগারেশন চেক করুন।'
                        : error.includes('not configured')
                        ? 'ফেসবুক পেজ আইডি বা টোকেন সেট করা নেই। অ্যাডমিন প্যানেল থেকে সেট করুন।'
                        : error}
                    </p>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fetchConversations()}
                    className="px-6 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center gap-2 mx-auto"
                  >
                    <RefreshCw size={14} />
                    আবার চেষ্টা করুন
                  </motion.button>
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      console.log('Selecting conversation:', conv.id);
                      setSelectedConv(conv);
                    }}
                    className={`w-full p-5 text-left rounded-[2rem] transition-all flex items-center gap-4 cursor-pointer relative z-40 ${
                      selectedConv?.id === conv.id 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 shadow-sm' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-[1.5rem] overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm">
                        {getParticipant(conv).picture?.data.url ? (
                          <img 
                            src={getParticipant(conv).picture!.data.url} 
                            alt={getParticipant(conv).name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-black text-sm truncate ${selectedConv?.id === conv.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                          {getParticipant(conv).name}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                          {new Date(conv.updated_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                        {conv.snippet}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-12 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">কোনো কনভারসেশন নেই</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${selectedConv ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col bg-white dark:bg-slate-900 lg:rounded-tl-[4rem] shadow-[0_-1px_20px_rgba(0,0,0,0.02)] relative z-20`}>
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedConv(null)}
                      className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <X size={20} />
                    </button>
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                      {getParticipant(selectedConv).picture?.data.url ? (
                        <img 
                          src={getParticipant(selectedConv).picture!.data.url} 
                          alt={getParticipant(selectedConv).name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                        {getParticipant(selectedConv).name}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Active on Facebook</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-slate-50/30 dark:bg-slate-900/30 relative">
                  {/* Subtle Background Accents */}
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
                  <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none" />

                  {isMessagesLoading ? (
                    <div className="flex flex-col items-center justify-center h-full relative z-10">
                      <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">মেসেজ লোড হচ্ছে...</p>
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg, index) => {
                      const isFromUser = msg.from.id === pageId;
                      const showAvatar = !isFromUser && (index === 0 || messages[index-1].from.id !== msg.from.id);
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          key={msg.id} 
                          className={`flex items-end gap-3 relative z-10 ${isFromUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isFromUser && (
                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                              {showAvatar && getParticipant(selectedConv).picture?.data.url ? (
                                <img 
                                  src={getParticipant(selectedConv).picture!.data.url} 
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <User size={14} />
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className={`max-w-[75%] p-4 sm:p-5 rounded-[2rem] text-sm font-medium shadow-sm ${
                            isFromUser 
                              ? 'bg-emerald-600 text-white rounded-br-none shadow-emerald-100 dark:shadow-none' 
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-none'
                          }`}>
                            <p className="leading-relaxed">{msg.message}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest mt-2 block ${isFromUser ? 'text-emerald-200' : 'text-slate-400'}`}>
                              {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 relative z-10">
                      <MessageSquare size={48} className="opacity-10 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">কোনো মেসেজ নেই</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-6 sm:p-8 border-t border-slate-50 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                  <form onSubmit={handleSendMessage} className="flex gap-4">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="মেসেজ লিখুন..."
                      className="flex-1 px-6 py-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-[2rem] shadow-xl shadow-emerald-200 dark:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                      <span className="hidden sm:inline font-black uppercase tracking-widest text-xs">Send</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-10 animate-pulse" />
                  <div className="bg-red-50 dark:bg-red-900/10 p-10 rounded-[3rem] relative z-10 border border-red-100 dark:border-red-900/20">
                    <MessageSquare size={64} className="text-red-500" />
                  </div>
                </div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">একটি কনভারসেশন <span className="text-red-500">সিলেক্ট করুন</span></h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-4 uppercase tracking-widest leading-relaxed">
                  বামে থাকা তালিকা থেকে যেকোনো একজনের নাম সিলেক্ট করে সরাসরি চ্যাট শুরু করুন।
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FacebookMessagingPanel;
