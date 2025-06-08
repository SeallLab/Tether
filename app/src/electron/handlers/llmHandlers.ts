import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import type { ActivityMonitoringService } from '../services/ActivityMonitoringService.js';

export function setupLLMHandlers(activityMonitoringService: ActivityMonitoringService) {
  // LLM Service IPC handlers
  ipcMain.handle(IPC_CHANNELS.SET_LLM_API_KEY, async (event, apiKey) => {
    try {
      activityMonitoringService.initializeLLM(apiKey);
      return { success: true, data: activityMonitoringService.getLLMStatus() };
    } catch (error) {
      console.error('[IPC] Set LLM API key error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_LLM_STATUS, async () => {
    try {
      const status = activityMonitoringService.getLLMStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error('[IPC] Get LLM status error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 