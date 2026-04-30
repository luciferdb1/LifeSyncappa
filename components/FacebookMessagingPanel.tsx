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
      const response = await fetch('/api/messenger/conversations');
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          const errMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
          throw new Error(errMsg);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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
      if (error.message !== 'Page Access Token or Page ID not configured') {
        console.error("Error fetching conversations:", error);
      }
      let errorMsg = error.message || "Error loading conversations.";
      if (errorMsg === "Failed to fetch") {
        errorMsg = "Cannot connect to the server. Please check your internet connection or disable adblocker.";
      }
      setError(errorMsg);
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
      new Notification(`New Message: ${participant.name}`, {
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

  const fetchMessages = async (psid: string, silent = false) => {
    if (!silent) setIsMessagesLoading(true);
    try {
      const response = await fetch(`/api/messenger/messages/${psid}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          const errMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
          throw new Error(errMsg);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.data) {
        // Facebook returns messages in reverse chronological order
        setMessages(data.data.reverse());
      }
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      let errorMsg = error.message || "Error loading messages.";
      if (errorMsg === "Failed to fetch") {
        errorMsg = "Cannot connect to the server. Please check your internet connection or disable adblocker.";
      }
      setError(errorMsg);
    } finally {
      if (!silent) setIsMessagesLoading(false);
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
        fetchMessages(psid, true);
      }, 5000);
      
      return () => clearInterval(msgInterval);
    }
  }, [selectedConv, pageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedConv?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSending) return;

    setIsSending(true);
    const psid = getPSID(selectedConv);

    try {
      const response = await fetch('/api/messenger/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: psid,
          message: newMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          const errMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : errorData.error;
          throw new Error(errMsg);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.ok) {
        setNewMessage('');
        // Refresh messages
        fetchMessages(psid, true);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      let errorMsg = error.message || "Error sending message.";
      
      // Check for Facebook 24-hour window error (code 10, subcode 2018278)
      if (errorMsg.includes("outside of allowed window") || errorMsg.includes("2018278") || errorMsg.includes("code\":10")) {
        errorMsg = "According to Facebook policy, you cannot reply if 24 hours have passed since the user's last message. You can reply once the user sends a message again.";
      } else if (errorMsg === "Failed to fetch") {
        errorMsg = "Cannot connect to the server. Please check your internet connection.";
      }
      
      alert(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#242526] z-[60] flex flex-col overflow-hidden font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-white dark:bg-[#242526] h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[#0084ff]">
              <Facebook size={28} />
            </div>
            <h2 className="text-2xl font-bold text-black dark:text-white">
              Chat
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchConversations(true)} 
              disabled={isRefreshing}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#3a3b3c] flex items-center justify-center text-black dark:text-white hover:bg-gray-200 dark:hover:bg-[#4e4f50] transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onClose} 
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#3a3b3c] flex items-center justify-center text-black dark:text-white hover:bg-gray-200 dark:hover:bg-[#4e4f50] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-[#242526]">
          {/* Sidebar: Conversations List */}
          <div className={`${selectedConv ? 'hidden lg:flex' : 'flex'} w-full lg:w-[360px] border-r border-gray-200 dark:border-gray-700 flex-col bg-white dark:bg-[#242526] shrink-0`}>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="animate-spin text-[#0084ff] mb-2" size={28} />
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error.includes('permission(s) must be granted') || error.includes('pages_messaging')
                        ? 'Token permission is incorrect. Please generate a new token with "pages_messaging" and "pages_read_engagement" permissions.'
                        : error.includes('expired') || error.includes('validating access token') || error.includes('OAuthException')
                        ? 'Session expired or token invalid. Please provide a new token from the admin panel.' 
                        : error.includes('Unsupported get request')
                        ? 'Issue with Page ID or permissions.'
                        : error.includes('not configured')
                        ? 'Facebook is not configured. Please setup from the admin panel.'
                        : error}
                    </p>
                  </div>
                  <button 
                    onClick={() => fetchConversations()}
                    className="px-4 py-2 bg-[#0084ff] text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <RefreshCw size={16} />
                    Try Again
                  </button>
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full p-2 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
                      selectedConv?.id === conv.id 
                        ? 'bg-gray-100 dark:bg-gray-800' 
                        : 'hover:bg-gray-50 dark:hover:bg-[#3a3b3c]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                        {getParticipant(conv).picture?.data.url ? (
                          <img 
                            src={getParticipant(conv).picture!.data.url} 
                            alt={getParticipant(conv).name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#0084ff] border-2 border-white dark:border-[#242526] rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`font-semibold text-[15px] truncate ${conv.unread_count > 0 ? 'text-black dark:text-white' : 'text-gray-900 dark:text-gray-200'}`}>
                          {getParticipant(conv).name}
                        </span>
                        <span className={`text-xs shrink-0 ${conv.unread_count > 0 ? 'text-[#0084ff] font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                          {new Date(conv.updated_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-[13px] truncate ${conv.unread_count > 0 ? 'text-black dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        {conv.snippet}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No conversations found.
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${selectedConv ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col bg-white dark:bg-[#242526]`}>
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center shrink-0 shadow-sm z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedConv(null)}
                      className="lg:hidden p-2 -ml-2 text-[#0084ff] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                      {getParticipant(selectedConv).picture?.data.url ? (
                        <img 
                          src={getParticipant(selectedConv).picture!.data.url} 
                          alt={getParticipant(selectedConv).name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-[15px] text-black dark:text-white leading-tight">
                        {getParticipant(selectedConv).name}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Messenger
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-white dark:bg-[#242526]">
                  {isMessagesLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin text-[#0084ff]" size={24} />
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg, index) => {
                      const isFromUser = msg.from.id === pageId;
                      const showAvatar = !isFromUser && (index === messages.length - 1 || messages[index+1].from.id !== msg.from.id);
                      const isFirstInGroup = index === 0 || messages[index-1].from.id !== msg.from.id;
                      const isLastInGroup = index === messages.length - 1 || messages[index+1].from.id !== msg.from.id;
                      
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex items-end gap-2 ${isFromUser ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                        >
                          {!isFromUser && (
                            <div className="w-7 h-7 shrink-0">
                              {showAvatar ? (
                                <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                  {getParticipant(selectedConv).picture?.data.url ? (
                                    <img 
                                      src={getParticipant(selectedConv).picture!.data.url} 
                                      alt=""
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <User size={14} />
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                          
                          <div className={`max-w-[70%] flex flex-col ${isFromUser ? 'items-end' : 'items-start'}`}>
                            <div 
                              className={`px-3.5 py-2 text-[15px] ${
                                isFromUser 
                                  ? 'bg-[#0084ff] text-white' 
                                  : 'bg-[#e4e6eb] dark:bg-[#3e4042] text-black dark:text-white'
                              } ${
                                isFromUser
                                  ? `rounded-l-[18px] ${isFirstInGroup ? 'rounded-tr-[18px]' : 'rounded-tr-[4px]'} ${isLastInGroup ? 'rounded-br-[18px]' : 'rounded-br-[4px]'}`
                                  : `rounded-r-[18px] ${isFirstInGroup ? 'rounded-tl-[18px]' : 'rounded-tl-[4px]'} ${isLastInGroup ? 'rounded-bl-[18px]' : 'rounded-bl-[4px]'}`
                              }`}
                            >
                              <p className="leading-snug break-words">{msg.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="text-sm">No messages</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-3 bg-white dark:bg-[#242526] shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    <div className="flex-1 bg-[#f0f2f5] dark:bg-[#3a3b3c] rounded-full flex items-center px-4 py-2 min-h-[40px]">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Aa"
                        className="w-full bg-transparent text-black dark:text-white text-[15px] outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className="p-2 text-[#0084ff] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent flex shrink-0"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-[#242526]">
                <h3 className="text-xl font-semibold text-black dark:text-white">Select a Chat</h3>
                <p className="text-[15px] text-gray-500 dark:text-gray-400 mt-2">
                  Select a conversation from the list to send a message.
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
