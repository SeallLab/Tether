import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatWindowProps {
  context?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);



  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with context if provided
  useEffect(() => {
    if (context && messages.length === 0) {
      if (context === 'daily-plan') {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          text: "Hi! I noticed you just started your day. What are your main goals and priorities for today? I'm here to help you plan and stay focused.",
          sender: 'assistant',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    }
  }, [context, messages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Simulate AI response (replace with actual LLM integration)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Thanks for sharing! I understand you want to focus on: "${userMessage.text}". That's a great goal. How can I help you break this down into actionable steps or stay accountable throughout the day?`,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  return (
    <div className="flex flex-col h-full bg-black backdrop-blur-xl rounded-xl shadow-2xl border border-white/20">
      {/* Search Input */}
      <div className="p-6 pb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={context === 'daily-plan' ? "What's your plan for today?" : "Ask me anything..."}
            className="w-full pl-12 pr-4 py-2 text-lg border border-slate-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 placeholder-slate-400"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results/Messages */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">💭</span>
            </div>
            <p className="text-slate-500 text-sm">
              {context === 'daily-plan' 
                ? "Share your goals and priorities for today" 
                : "Type to start a conversation"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="group">
              {message.sender === 'user' ? (
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs font-medium">Me</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm leading-relaxed">{message.text}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs">AI</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm leading-relaxed">{message.text}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (if no messages) */}
      {messages.length === 0 && !isLoading && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 gap-2">
            {context === 'daily-plan' ? (
              <>
                <button
                  onClick={() => setInputText("Help me prioritize my tasks for today")}
                  className="text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  📋 Help me prioritize my tasks
                </button>
                <button
                  onClick={() => setInputText("What should I focus on first?")}
                  className="text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  🎯 What should I focus on first?
                </button>
                <button
                  onClick={() => setInputText("Create a schedule for my day")}
                  className="text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  ⏰ Create a schedule for my day
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setInputText("How can I be more productive?")}
                  className="text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  ⚡ How can I be more productive?
                </button>
                <button
                  onClick={() => setInputText("Help me plan my day")}
                  className="text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  📅 Help me plan my day
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 