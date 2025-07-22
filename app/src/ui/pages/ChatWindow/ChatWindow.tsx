import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from '../../components/common';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  context: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface ChatWindowProps {
  context?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load chat sessions on mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with context if provided
  useEffect(() => {
    if (context === 'daily-plan' && !currentSessionId && messages.length === 0) {
      // Only add welcome message, don't create session yet
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        text: "Hi! I noticed you just started your day. What are your main goals and priorities for today? I'm here to help you plan and stay focused!",
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [context, currentSessionId, messages.length]);

  const loadChatSessions = async () => {
    try {
      const result = await window.electron?.chat?.getSessions();
      if (result?.success) {
        setSessions(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  };

  const createNewSession = async (sessionContext: string = 'general') => {
    try {
      const result = await window.electron?.chat?.createSession(sessionContext);
      if (result?.success) {
        const newSessionId = result.data.sessionId;
        setCurrentSessionId(newSessionId);
        setMessages([]);
        await loadChatSessions();
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const result = await window.electron?.chat?.getHistory(sessionId);
      if (result?.success && result.data) {
        const chatMessages = result.data.map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(chatMessages);
        setCurrentSessionId(sessionId);
        setShowSessions(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const result = await window.electron?.chat?.deleteSession(sessionId);
      if (result?.success) {
        await loadChatSessions();
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

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

    try {
      // Send message to chat service (session will be created if needed)
      const result = await window.electron?.chat?.sendMessage({
        message: userMessage.text,
        sessionId: currentSessionId,
        context: context || 'general'
      });

      if (result?.success) {
        const response = result.data;
        setCurrentSessionId(response.sessionId);
        
        const assistantMessage: Message = {
          id: response.messageId,
          text: response.message,
          sender: 'assistant',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        await loadChatSessions(); // Refresh sessions list
      } else {
        throw new Error(result?.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now, but I'm here to help! Try asking about focus techniques, task planning, or managing ADHD challenges. 💙",
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getQuickActions = () => {
    if (context === 'daily-plan') {
      return [
        { text: "Help me prioritize my tasks for today", icon: "📋" },
        { text: "What should I focus on first?", icon: "🎯" }
      ];
    }
    return [
      { text: "I'm feeling overwhelmed, help me break this down", icon: "🧘" },
      { text: "I keep getting distracted, what can I do?", icon: "⚡" }
    ];
  };

  // Check if we have any actual conversation (excluding welcome messages)
  const hasConversation = messages.some(msg => msg.sender === 'user');

  return (
    <div className="flex flex-col h-full bg-[#131e33] backdrop-blur-xl rounded-xl shadow-2xl border border-white/20">
      {/* Header with input and session controls in same row */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={context === 'daily-plan' ? "What's your plan for today?" : "Ask me anything about focus, planning, or ADHD..."}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => createNewSession(context || 'general')}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="New Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Chat History"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sessions sidebar */}
      {showSessions && (
        <div className="border-b border-white/10 bg-white/5 max-h-32 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-white text-sm font-medium mb-2">Recent Chats</h3>
            {sessions.length === 0 ? (
              <p className="text-slate-400 text-xs">No previous chats</p>
            ) : (
              <div className="space-y-1">
                {sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="flex items-center justify-between group">
                    <button
                      onClick={() => loadSession(session.id)}
                      className="flex-1 text-left text-slate-300 hover:text-white text-xs p-2 rounded hover:bg-white/10 transition-colors truncate"
                    >
                      {session.title}
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions (only show if no conversation has started) */}
      {!hasConversation && !isLoading && (
        <div className="px-6 py-4 border-b border-white/10">
          <div className="grid grid-cols-1 gap-2">
            {getQuickActions().map((action, index) => (
              <button
                key={index}
                onClick={() => setInputText(action.text)}
                className="text-left px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center space-x-3"
              >
                <span className="text-lg">{action.icon}</span>
                <span>{action.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">💭</span>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              {context === 'daily-plan' 
                ? "Ready to plan your day? Share your goals and I'll help you stay focused!" 
                : "Hi! I'm Tether, your ADHD-friendly assistant. How can I help you focus today?"}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="group">
              {message.sender === 'user' ? (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs font-medium">You</span>
                  </div>
                  <div className="flex-1">
                    <MarkdownRenderer 
                      content={message.text} 
                      className="text-white text-sm leading-relaxed"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs font-medium">T</span>
                  </div>
                  <div className="flex-1">
                    <MarkdownRenderer 
                      content={message.text} 
                      className="text-white text-sm leading-relaxed"
                    />
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
    </div>
  );
}; 