import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import type { ActivityMonitoringService } from '../services/ActivityMonitoringService.js';

export function setupActivityHandlers(activityMonitoringService: ActivityMonitoringService) {
  // Activity monitoring IPC handlers
  ipcMain.handle(IPC_CHANNELS.START_ACTIVITY_MONITORING, async () => {
    try {
      await activityMonitoringService.start();
      return { success: true, data: activityMonitoringService.getStatus() };
    } catch (error) {
      console.error('[IPC] Start monitoring error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STOP_ACTIVITY_MONITORING, async () => {
    try {
      await activityMonitoringService.stop();
      return { success: true, data: activityMonitoringService.getStatus() };
    } catch (error) {
      console.error('[IPC] Stop monitoring error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_ACTIVITY_STATUS, async () => {
    try {
      const status = activityMonitoringService.getStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error('[IPC] Get status error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_RECENT_ACTIVITY, async (event, minutes = 60) => {
    try {
      const activity = await activityMonitoringService.getRecentActivity(minutes);
      return { success: true, data: activity };
    } catch (error) {
      console.error('[IPC] Get recent activity error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_MONITORING_CONFIG, async (event, config) => {
    try {
      await activityMonitoringService.updateConfig(config);
      return { success: true, data: activityMonitoringService.getStatus() };
    } catch (error) {
      console.error('[IPC] Update config error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 