import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { ChatService } from '../services/ChatService.js';
import { ChatRequest } from '../../shared/types.js';

export function setupChatHandlers(chatService: ChatService) {
  // Send chat message
  ipcMain.handle(IPC_CHANNELS.SEND_CHAT_MESSAGE, async (event, request: ChatRequest) => {
    try {
      const response = await chatService.sendMessage(request);
      return { success: true, data: response };
    } catch (error) {
      console.error('[IPC] Send chat message error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get chat sessions
  ipcMain.handle(IPC_CHANNELS.GET_CHAT_SESSIONS, async () => {
    try {
      const sessions = chatService.getChatSessions();
      return { success: true, data: sessions };
    } catch (error) {
      console.error('[IPC] Get chat sessions error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get chat history for a specific session
  ipcMain.handle(IPC_CHANNELS.GET_CHAT_HISTORY, async (event, sessionId: string) => {
    try {
      const history = chatService.getChatHistory(sessionId);
      return { success: true, data: history };
    } catch (error) {
      console.error('[IPC] Get chat history error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Create new chat session
  ipcMain.handle(IPC_CHANNELS.CREATE_CHAT_SESSION, async (event, context?: string) => {
    try {
      const sessionId = chatService.createNewSession(context);
      return { success: true, data: { sessionId } };
    } catch (error) {
      console.error('[IPC] Create chat session error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Delete chat session
  ipcMain.handle(IPC_CHANNELS.DELETE_CHAT_SESSION, async (event, sessionId: string) => {
    try {
      const deleted = chatService.deleteSession(sessionId);
      return { success: true, data: { deleted } };
    } catch (error) {
      console.error('[IPC] Delete chat session error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 