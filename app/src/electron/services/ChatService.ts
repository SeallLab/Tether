import { ChatMessage, ChatSession, ChatRequest, ChatResponse } from '../../shared/types.js';
import { ActivityLogger } from './ActivityLogger.js';
import { v4 as uuidv4 } from 'uuid';
import { PythonServerService } from './PythonServerService.js';
import { injectable, inject } from 'tsyringe';
import { Logger } from '../utils/Logger.js';

@injectable()
export class ChatService {
  private activityLogger: ActivityLogger;
  private pythonServerService: PythonServerService;
  private logger: Logger;
  constructor(
    @inject(ActivityLogger) activityLogger: ActivityLogger,
    @inject(PythonServerService) pythonServerService: PythonServerService
  ) {
    this.activityLogger = activityLogger;
    this.pythonServerService = pythonServerService;
    this.logger = new Logger({ name: 'ChatService' });
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      let sessionId = request.sessionId;
      
      // Create session if none provided
      if (!sessionId) {
        sessionId = await this.createNewSession(request.context || 'general');
      }

      // Get recent activity logs for context (last 2 hours)
      const recentLogs = await this.getRecentActivityContext();

      // Send message to Flask API with activity context and mode
      const response = await this.pythonServerService.apiRequest('POST', '/generate', {
        message: request.message,
        session_id: sessionId,
        activity_context: recentLogs,
        mode: request.mode || 'general',
        detective_mode: request.detectiveMode || 'teaching'
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
      this.logger.error('Error sending message:', error);
      
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
      this.logger.error('Error creating session:', error);
      // Return a fallback session ID
      return `fallback-${uuidv4()}`;
    }
  }

  async getChatSessions(): Promise<ChatSession[]> {
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
      this.logger.error('Error getting sessions:', error);
      return [];
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
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
      this.logger.error('Error getting chat history:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await this.pythonServerService.apiRequest('DELETE', `/conversation/${sessionId}`);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete session');
      }

      const data = response.data;
      return data.success || false;

    } catch (error) {
      this.logger.error('Error deleting session:', error);
      return false;
    }
  }

  private async getRecentActivityContext(): Promise<any[]> {
    try {
      // Get activity logs from the last 2 days
      const twoDaysAgo = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000));
      const now = new Date();
      
      const logs = await this.activityLogger.getLogsByDateRange(twoDaysAgo, now);
      
      // Filter and summarize relevant activity
      const relevantLogs = logs.filter(log => 
        log.type === 'window_change' || log.type === 'idle'
      ).map(log => ({
        timestamp: log.timestamp,
        type: log.type,
        data: log.data
      }));

      return relevantLogs;
      
    } catch (error) {
      this.logger.error('Error getting activity context:', error);
      return [];
    }
  }

  async getChecklist(sessionId: string, messageId: string): Promise<any> {
    try {
      const response = await this.pythonServerService.apiRequest('GET', `/checklist/${sessionId}/${messageId}`);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to get checklist');
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      return data.data || [];

    } catch (error) {
      this.logger.error('Error getting checklist:', error);
      return [];
    }
  }

  async saveChecklist(sessionId: string, messageId: string, tasks: any[]): Promise<boolean> {
    try {
      const response = await this.pythonServerService.apiRequest('POST', `/checklist/${sessionId}/${messageId}`, {
        tasks: tasks
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to save checklist');
      }

      const data = response.data;
      return data.success || false;

    } catch (error) {
      this.logger.error('Error saving checklist:', error);
      return false;
    }
  }

  async updateChecklistItem(sessionId: string, messageId: string, itemId: string, isCompleted: boolean): Promise<boolean> {
    try {
      const response = await this.pythonServerService.apiRequest('PATCH', `/checklist/${sessionId}/${messageId}/item/${itemId}`, {
        isCompleted: isCompleted
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to update checklist item');
      }

      const data = response.data;
      return data.success || false;

    } catch (error) {
      this.logger.error('Error updating checklist item:', error);
      return false;
    }
  }
} 