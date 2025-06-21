import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { NotificationService } from '../services/NotificationService.js';

export function setupNotificationHandlers(notificationService: NotificationService) {
  // Get notification statistics
  ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATION_STATS, async () => {
    try {
      const stats = notificationService.getNotificationStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('[IPC] Get notification stats error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get recent notifications
  ipcMain.handle(IPC_CHANNELS.GET_RECENT_NOTIFICATIONS, async (event, minutes = 60) => {
    try {
      const notifications = notificationService.getRecentNotifications(minutes);
      return { success: true, data: notifications };
    } catch (error) {
      console.error('[IPC] Get recent notifications error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 