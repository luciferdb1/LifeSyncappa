import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { getDonationAdvice } from '../services/geminiService';

const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'আসসালামু আলাইকুম! আমি রক্তদান সহকারী। রক্তদান সম্পর্কিত কোনো প্রশ্ন থাকলে আমাকে করতে পারেন।' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const responseText = await getDonationAdvice(input);
    
    setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    setLoading(false);
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-transform hover:scale-105 z-40 flex items-center"
        >
          <MessageCircle size={24} />
          <span className="ml-2 font-semibold hidden md:inline">সাহায্য দরকার?</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[90vw] md:w-[350px] h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
          <div className="bg-blue-600 dark:bg-blue-700 p-4 flex justify-between items-center text-white">
            <h3 className="font-bold flex items-center"><MessageCircle size={18} className="mr-2"/> রক্তদান সহকারী</h3>
            <button onClick={() => setIsOpen(false)} className="hover:bg-blue-500 dark:hover:bg-blue-600 p-1 rounded transition-colors"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-950 space-y-3 transition-colors duration-300">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm transition-colors duration-200 ${msg.role === 'user' ? 'bg-blue-600 dark:bg-blue-700 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
               <div className="flex justify-start">
                 <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg rounded-bl-none shadow-sm transition-colors duration-200">
                   <Loader2 className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" />
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex gap-2 transition-colors duration-300">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="এখানে প্রশ্ন লিখুন..."
              className="flex-1 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-colors duration-200"
            />
            <button 
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 dark:bg-blue-700 text-white p-2 rounded-full hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChat;