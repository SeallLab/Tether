import { ChatMessage, ChatSession, ChatRequest, ChatResponse, LLMProvider, ActivityType, ChatInteractionData } from '../../shared/types.js';
import { ActivityLogger } from './ActivityLogger.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private llmProvider: LLMProvider | null = null;
  private activityLogger: ActivityLogger;
  private chatLogPath: string;

  constructor(activityLogger: ActivityLogger, chatLogPath?: string) {
    this.activityLogger = activityLogger;
    this.chatLogPath = chatLogPath || path.join(process.cwd(), 'chat_logs.json');
    this.loadChatHistory();
  }

  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const sessionId = request.sessionId || this.createNewSession(request.context || 'general');
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      text: request.message,
      sender: 'user',
      timestamp: Date.now(),
      sessionId
    };

    // Add user message to session
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    // Log user message
    await this.logChatInteraction(userMessage);

    // Generate AI response
    const aiResponse = await this.generateAIResponse(request.message, session);
    
    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      text: aiResponse,
      sender: 'assistant',
      timestamp: Date.now(),
      sessionId
    };

    // Add assistant message to session
    session.messages.push(assistantMessage);
    session.updatedAt = Date.now();

    // Generate a meaningful title if this is the first user message
    if (session.messages.filter(m => m.sender === 'user').length === 1) {
      session.title = await this.generateSessionTitle(request.message, session.context);
    }

    // Log assistant message
    await this.logChatInteraction(assistantMessage);

    // Save chat history
    await this.saveChatHistory();

    return {
      message: aiResponse,
      sessionId,
      messageId: assistantMessage.id
    };
  }

  private async generateAIResponse(userMessage: string, session: ChatSession): Promise<string> {
    if (!this.llmProvider) {
      return this.getFallbackResponse(userMessage, session.context);
    }

    try {
      const prompt = this.createADHDFocusedPrompt(userMessage, session);
      
      // Use chat-specific method if available
      if (typeof (this.llmProvider as any).generateChatResponse === 'function') {
        return await (this.llmProvider as any).generateChatResponse(prompt);
      }
      
      // Fallback to regular response method
      const response = await this.llmProvider.generateResponse(prompt);
      
      // Handle different response formats
      if (typeof response === 'string') {
        return response;
      } else if (typeof response === 'object' && response.message) {
        return response.message;
      } else if (typeof response === 'object') {
        // For focus notification responses, extract the message
        return response.message || 'I understand! How can I help you stay focused today?';
      }
      
      return this.getFallbackResponse(userMessage, session.context);
    } catch (error) {
      console.error('[ChatService] Error generating AI response:', error);
      return this.getFallbackResponse(userMessage, session.context);
    }
  }

  private createADHDFocusedPrompt(userMessage: string, session: ChatSession): string {
    const recentMessages = session.messages.slice(-6); // Last 3 exchanges
    const conversationHistory = recentMessages
      .map(msg => `${msg.sender}: ${msg.text}`)
      .join('\n');

    return `You are Tether, an AI assistant specifically designed to help people with ADHD stay focused and productive. 

CORE PRINCIPLES:
- Keep responses concise (2-3 sentences max)
- Be encouraging and understanding, never judgmental
- Focus on actionable, specific advice
- Break down complex tasks into smaller steps
- Acknowledge ADHD challenges (executive dysfunction, hyperfocus, time blindness)
- Use positive, motivating language

CONTEXT: ${session.context}

CONVERSATION HISTORY:
${conversationHistory}

USER MESSAGE: ${userMessage}

RESPONSE GUIDELINES:
- If they're struggling with focus: Suggest specific techniques (Pomodoro, body doubling, etc.)
- If they're overwhelmed: Help break tasks into smaller, manageable pieces
- If they're procrastinating: Offer gentle accountability and starting strategies
- If they're hyperfocusing: Remind them about breaks and self-care
- If they're planning: Help prioritize and create realistic timelines
- Always validate their experience and offer hope

Respond as Tether in a warm, understanding, and concise way:`;
  }

  private getFallbackResponse(userMessage: string, context: string): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('focus') || lowerMessage.includes('distracted')) {
      return "I understand focus can be challenging with ADHD. Try the 2-minute rule: if something takes less than 2 minutes, do it now. For bigger tasks, set a 15-minute timer and just start. 🎯";
    }
    
    if (lowerMessage.includes('overwhelmed') || lowerMessage.includes('too much')) {
      return "Feeling overwhelmed is totally normal with ADHD. Let's break this down: what's the ONE most important thing you need to do today? We can tackle the rest step by step. 💪";
    }
    
    if (lowerMessage.includes('procrastinating') || lowerMessage.includes('putting off')) {
      return "Procrastination often comes from perfectionism or task overwhelm. Try the 'Swiss cheese' method: poke holes in the task by doing small, random parts. Progress is progress! 🧀";
    }
    
    if (lowerMessage.includes('plan') || lowerMessage.includes('schedule')) {
      return "Great thinking ahead! For ADHD brains, visual planning works best. Try time-blocking with buffers between tasks, and remember to schedule breaks too. What's your top priority? 📅";
    }
    
    if (context === 'daily-plan') {
      return "That sounds like a solid goal! Remember to be realistic with your time estimates - ADHD brains often underestimate. What's the first small step you can take? 🚀";
    }
    
    return "I hear you! ADHD can make things challenging, but you've got this. What specific area would you like help with - focus, planning, or breaking down a task? 💙";
  }

  createNewSession(context: string = 'general'): string {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      title: this.generateTemporaryTitle(context),
      context,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  private generateTemporaryTitle(context: string): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    switch (context) {
      case 'daily-plan':
        return `Daily Planning - ${timeStr}`;
      case 'focus-help':
        return `Focus Session - ${timeStr}`;
      default:
        return `Chat - ${timeStr}`;
    }
  }

  private async generateSessionTitle(userMessage: string, context: string): Promise<string> {
    // Try to generate a meaningful title using LLM
    if (this.llmProvider && typeof (this.llmProvider as any).generateChatResponse === 'function') {
      try {
        const titlePrompt = `Generate a very short (2-4 words) title for a chat session based on this user message: "${userMessage}". 
        Context: ${context}. 
        Examples: "Daily Planning", "Focus Help", "Task Breakdown", "Procrastination Support".
        Only respond with the title, nothing else.`;
        
        const title = await (this.llmProvider as any).generateChatResponse(titlePrompt);
        // Clean up the response and limit length
        const cleanTitle = title.replace(/['"]/g, '').trim().substring(0, 30);
        if (cleanTitle && cleanTitle.length > 3) {
          return cleanTitle;
        }
      } catch (error) {
        console.error('[ChatService] Error generating session title:', error);
      }
    }
    
    // Fallback to context-based titles
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    switch (context) {
      case 'daily-plan':
        return `Daily Planning - ${timeStr}`;
      case 'focus-help':
        return `Focus Session - ${timeStr}`;
      default:
        return `Chat - ${timeStr}`;
    }
  }

  getChatSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.messages.some(msg => msg.sender === 'user')) // Only sessions with user messages
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getChatHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private async logChatInteraction(message: ChatMessage): Promise<void> {
    try {
      // Log to activity logger
      const chatData: ChatInteractionData = {
        sender: message.sender,
        message: message.text,
        sessionId: message.sessionId,
        messageId: message.id
      };
      
      this.activityLogger.log(ActivityType.CHAT_INTERACTION, chatData);
    } catch (error) {
      console.error('[ChatService] Error logging chat interaction:', error);
    }
  }

  private async saveChatHistory(): Promise<void> {
    try {
      const sessionsArray = Array.from(this.sessions.values())
        .filter(session => session.messages.some(msg => msg.sender === 'user')); // Only save sessions with user messages
      await fs.promises.writeFile(
        this.chatLogPath,
        JSON.stringify(sessionsArray, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[ChatService] Error saving chat history:', error);
    }
  }

  private loadChatHistory(): void {
    try {
      if (fs.existsSync(this.chatLogPath)) {
        const data = fs.readFileSync(this.chatLogPath, 'utf8');
        const sessionsArray: ChatSession[] = JSON.parse(data);
        
        this.sessions.clear();
        sessionsArray.forEach(session => {
          this.sessions.set(session.id, session);
        });
        
        console.log(`[ChatService] Loaded ${sessionsArray.length} chat sessions`);
      }
    } catch (error) {
      console.error('[ChatService] Error loading chat history:', error);
    }
  }
} 