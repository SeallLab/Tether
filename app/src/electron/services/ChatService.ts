import { ChatMessage, ChatSession, ChatRequest, ChatResponse } from '../../shared/types.js';
import { ActivityLogger } from './ActivityLogger.js';
import { v4 as uuidv4 } from 'uuid';

export class ChatService {
  private activityLogger: ActivityLogger;
  private pythonServerService: any; // Will be injected

  constructor(activityLogger: ActivityLogger, pythonServerService?: any) {
    this.activityLogger = activityLogger;
    this.pythonServerService = pythonServerService;
  }

  setPythonServerService(pythonServerService: any): void {
    this.pythonServerService = pythonServerService;
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    if (!this.pythonServerService || typeof this.pythonServerService.apiRequest !== 'function') {
      console.error('[ChatService] Python server service not properly initialized');
      // Return fallback response
      return {
        message: this.getFallbackResponse(request.message, request.context || 'general'),
        sessionId: request.sessionId || 'fallback',
        messageId: 'fallback'
      };
    }

    try {
      let sessionId = request.sessionId;
      
      // Create session if none provided
      if (!sessionId) {
        sessionId = await this.createNewSession(request.context || 'general');
      }

      // Send message to Flask API
      const response = await this.pythonServerService.apiRequest('POST', '/generate', {
        message: request.message,
        session_id: sessionId
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to send message');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      return {
        message: data.data.message,
        sessionId: data.data.sessionId,
        messageId: data.data.messageId
      };

    } catch (error) {
      console.error('[ChatService] Error sending message:', error);
      
      // Fallback response
      return {
        message: this.getFallbackResponse(request.message, request.context || 'general'),
        sessionId: request.sessionId || 'fallback',
        messageId: uuidv4()
      };
    }
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

  async createNewSession(context: string = 'general'): Promise<string> {
    if (!this.pythonServerService || typeof this.pythonServerService.apiRequest !== 'function') {
      console.error('[ChatService] Python server service not properly initialized');
      // Return a fallback session ID
      return `fallback-${Date.now()}`;
    }

    try {
      const response = await this.pythonServerService.apiRequest('POST', '/session', {
        context: context
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to create session');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      return data.session_id;

    } catch (error) {
      console.error('[ChatService] Error creating session:', error);
      // Return a fallback session ID
      return `fallback-${uuidv4()}`;
    }
  }

  async getChatSessions(): Promise<ChatSession[]> {
    if (!this.pythonServerService) {
      console.warn('[ChatService] Python server service not available, returning empty sessions');
      return [];
    }

    if (typeof this.pythonServerService.apiRequest !== 'function') {
      console.error('[ChatService] Python server service apiRequest method not available');
      return [];
    }

    try {
      const response = await this.pythonServerService.apiRequest('GET', '/sessions');

      if (!response.ok) {
        throw new Error(response.error || 'Failed to get sessions');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      return data.data || [];

    } catch (error) {
      console.error('[ChatService] Error getting sessions:', error);
      return [];
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    if (!this.pythonServerService || typeof this.pythonServerService.apiRequest !== 'function') {
      console.warn('[ChatService] Python server service not available');
      return [];
    }

    try {
      const response = await this.pythonServerService.apiRequest('GET', `/conversation/${sessionId}`);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to get chat history');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      return data.data || [];

    } catch (error) {
      console.error('[ChatService] Error getting chat history:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.pythonServerService || typeof this.pythonServerService.apiRequest !== 'function') {
      console.warn('[ChatService] Python server service not available');
      return false;
    }

    try {
      const response = await this.pythonServerService.apiRequest('DELETE', `/conversation/${sessionId}`);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete session');
      }

      const data = response.data;
      return data.success || false;

    } catch (error) {
      console.error('[ChatService] Error deleting session:', error);
      return false;
    }
  }
} 