import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer, ChecklistRenderer } from '../../components/common';
import { ChatMode, DetectiveMode } from '../../../shared/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  mode?: ChatMode;
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
  const [currentMode, setCurrentMode] = useState<ChatMode>('general');
  const [detectiveMode, setDetectiveMode] = useState<DetectiveMode>('teaching');
  const [isCodingWorkflow, setIsCodingWorkflow] = useState(false);
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
          timestamp: new Date(msg.timestamp),
          mode: msg.mode
        }));
        
        // Check if this session has workflow messages
        const hasWorkflowMessages = chatMessages.some((msg: Message) => 
          msg.mode && msg.mode !== 'general'
        );
        
        // Restore workflow state if session had workflow messages
        if (hasWorkflowMessages) {
          setIsCodingWorkflow(true);
          // Set mode to the most recent workflow message's mode, or default to planner
          const lastWorkflowMessage = chatMessages.reverse().find((msg: Message) => 
            msg.mode && msg.mode !== 'general'
          );
          setCurrentMode(lastWorkflowMessage?.mode || 'planner');
          chatMessages.reverse(); // Restore original order
        } else {
          setIsCodingWorkflow(false);
          setCurrentMode('general');
        }
        
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
      timestamp: new Date(),
      mode: currentMode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Send message to chat service (session will be created if needed)
      const result = await window.electron?.chat?.sendMessage({
        message: userMessage.text,
        sessionId: currentSessionId,
        context: context || 'general',
        mode: currentMode,
        detectiveMode: currentMode === 'detective' ? detectiveMode : undefined
      });

      if (result?.success) {
        const response = result.data;
        setCurrentSessionId(response.sessionId);
        
        const assistantMessage: Message = {
          id: response.messageId,
          text: response.message,
          sender: 'assistant',
          timestamp: new Date(),
          mode: currentMode
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
        { text: "Help me prioritize my tasks for today" },
        { text: "What should I focus on first?" }
      ];
    }
    return [
      { text: "I'm feeling overwhelmed, help me break this down" },
      { text: "I keep getting distracted, what can I do?" }
    ];
  };

  // Check if we have any actual conversation (excluding welcome messages)
  const hasConversation = messages.some(msg => msg.sender === 'user');
  
  // Filter messages by current mode - show both user and AI messages for the selected mode
  const filteredMessages = messages.filter(msg => {
    // If we're in coding workflow, only show messages from the current mode
    if (isCodingWorkflow) {
      return msg.mode === currentMode;
    }
    // If we're in general mode, show general messages or messages without a mode
    return msg.mode === 'general' || !msg.mode;
  });

  const tabs: Array<{ id: ChatMode; label: string; description: string }> = [
    { id: 'planner', label: 'Planner', description: 'Planning & Architecture' },
    { id: 'builder', label: 'Builder', description: 'Active Coding' },
    { id: 'detective', label: 'Detective', description: 'Debugging' },
    { id: 'reviewer', label: 'Reviewer', description: 'Testing & Polish' },
  ];

  const handleEnterCodingWorkflow = () => {
    setIsCodingWorkflow(true);
    setCurrentMode('planner');
  };

  const handleExitCodingWorkflow = () => {
    // Create a new session when exiting workflow to avoid confusion
    createNewSession(context || 'general');
    setIsCodingWorkflow(false);
    setCurrentMode('general');
  };

  return (
    <div className="flex flex-col h-full bg-[#131e33] backdrop-blur-xl rounded-xl shadow-2xl border border-white/20">
      {/* Tab Navigation - Only show in coding workflow mode */}
      {isCodingWorkflow && (
        <div className="border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Tabs */}
            <div className="flex bg-black/20 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentMode(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    currentMode === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Center/Right: Detective mode toggle */}
              {currentMode === 'detective' && (
                <div className="flex bg-black/20 rounded-lg p-1">
                  <button
                    onClick={() => setDetectiveMode('teaching')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      detectiveMode === 'teaching'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Teaching
                  </button>
                  <button
                    onClick={() => setDetectiveMode('quick-fix')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      detectiveMode === 'quick-fix'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Quick Fix
                  </button>
                </div>
              )}

              {/* Far Right: Exit coding workflow button */}
              <button
                onClick={handleExitCodingWorkflow}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Exit Coding Workflow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
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

      {/* Quick Actions and Coding Workflow Button - Only show in general mode when no conversation */}
      {!hasConversation && !isLoading && !isCodingWorkflow && (
        <div className="px-6 py-4 border-b border-white/10">
          {/* Coding Workflow Button */}
          <div className="mb-4">
            <button
              onClick={handleEnterCodingWorkflow}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg text-white hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-200"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="font-medium">Start Coding Workflow</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Get step-by-step guidance for planning, coding, debugging, and completing projects</p>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-2">
            {getQuickActions().map((action, index) => (
              <button
                key={index}
                onClick={() => setInputText(action.text)}
                className="text-left px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {action.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredMessages.length === 0 && !isLoading && (
          <div className="text-center py-12 flex flex-col items-center justify-center h-full max-h-[60vh]">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-inner">
              {isCodingWorkflow ? (
                <svg className="w-10 h-10 text-blue-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-purple-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            </div>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              {isCodingWorkflow ? (
                <>
                  {currentMode === 'planner' && "Ready to plan your project? Share your idea and I'll break it down into manageable tasks"}
                  {currentMode === 'builder' && "Let's build something! What would you like to code today?"}
                  {currentMode === 'detective' && "Got a bug? Paste your error and let's solve it together"}
                  {currentMode === 'reviewer' && "Ready to polish your project? Let's add tests, docs, and reflection"}
                </>
              ) : (
                context === 'daily-plan' 
                  ? "Ready to plan your day? Share your goals and I'll help you stay focused" 
                  : "Hi! I'm Tether, your ADHD-friendly assistant. How can I help you focus today?"
              )}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filteredMessages.map((message) => (
            <div key={message.id} className="group">
              {message.sender === 'user' ? (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs font-medium">You</span>
                  </div>
                  <div className="flex-1 min-w-0">
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
                  <div className="flex-1 min-w-0">
                    {/* Mode badge */}
                    {message.mode && message.mode !== 'general' && (
                      <div className="mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {tabs.find(t => t.id === message.mode)?.label}
                        </span>
                      </div>
                    )}
                    
                    {/* Render checklist for planner mode or regular markdown */}
                    {message.mode === 'planner' && message.text.includes('- [ ]') ? (
                      <ChecklistRenderer
                        content={message.text}
                        messageId={message.id}
                        sessionId={currentSessionId || ''}
                      />
                    ) : (
                      <MarkdownRenderer 
                        content={message.text} 
                        className="text-white text-sm leading-relaxed"
                      />
                    )}
                    
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