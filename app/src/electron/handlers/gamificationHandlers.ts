import { ipcMain, BrowserWindow, Notification } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import type { GamificationService } from '../services/GamificationService.js';
import type { NotificationService } from '../services/NotificationService.js';

export function setupGamificationHandlers(gamificationService: GamificationService, notificationService?: NotificationService) {
  
  // Helper function to ensure gamification service is loaded
  const ensureGamificationLoaded = async () => {
    if (!gamificationService.isDataLoaded()) {
      console.log('[GamificationHandlers] Gamification data not loaded yet, attempting to load...');
      await gamificationService.load();
    }
  };

  // Helper function to send achievement notifications
  const sendAchievementNotification = async (title: string, body: string) => {
    try {
      if (notificationService) {
        // Use the notification service if available
        await notificationService.sendNotification({
          title,
          body,
          silent: false,
          urgency: 'normal'
        });
      } else {
        // Fallback to direct Electron notification
        const notification = new Notification({
          title,
          body,
          silent: false
        });
        notification.show();
      }
      console.log(`[GamificationHandlers] Achievement notification sent: ${title}`);
    } catch (error) {
      console.error('[GamificationHandlers] Failed to send achievement notification:', error);
    }
  };
  // Get all gamification data
  ipcMain.handle(IPC_CHANNELS.GET_GAMIFICATION_DATA, async () => {
    try {
      await ensureGamificationLoaded();
      
      const data = gamificationService.getData();
      const themes = gamificationService.getThemes();
      const currentTheme = gamificationService.getCurrentTheme();
      
      return { 
        success: true, 
        data: {
          ...data,
          availableThemes: themes,
          currentThemeData: currentTheme
        }
      };
    } catch (error) {
      console.error('[IPC] Get gamification data error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Award points (typically called internally)
  ipcMain.handle(IPC_CHANNELS.AWARD_POINTS, async (event, { points, type, description, metadata }) => {
    try {
      const pointEvent = await gamificationService.awardPoints(points, type, description, metadata);
      
      // Send notification to UI about points earned
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window: BrowserWindow) => {
        window.webContents.send(IPC_CHANNELS.POINT_EARNED_NOTIFICATION, {
          points: pointEvent.points,
          description: pointEvent.description,
          totalPoints: gamificationService.getData().points
        });
      });
      
      return { success: true, data: pointEvent };
    } catch (error) {
      console.error('[IPC] Award points error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Unlock a theme
  ipcMain.handle(IPC_CHANNELS.UNLOCK_THEME, async (event, themeId) => {
    try {
      await ensureGamificationLoaded();
      const success = await gamificationService.unlockTheme(themeId);
      if (success) {
        const updatedData = gamificationService.getData();
        return { success: true, data: { unlockedThemes: updatedData.unlockedThemes, points: updatedData.points } };
      } else {
        return { success: false, error: 'Unable to unlock theme. Check if you have enough points or if theme is already unlocked.' };
      }
    } catch (error) {
      console.error('[IPC] Unlock theme error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Set dock theme
  ipcMain.handle(IPC_CHANNELS.SET_DOCK_THEME, async (event, themeId) => {
    try {
      await ensureGamificationLoaded();
      const success = await gamificationService.setDockTheme(themeId);
      if (success) {
        const currentTheme = gamificationService.getCurrentTheme();
        
        // Notify all windows about theme change
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window: BrowserWindow) => {
          window.webContents.send('theme-changed', themeId);
        });
        
        return { success: true, data: { currentTheme } };
      } else {
        return { success: false, error: 'Theme not unlocked or not found.' };
      }
    } catch (error) {
      console.error('[IPC] Set dock theme error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Complete a quest (typically called internally)
  ipcMain.handle(IPC_CHANNELS.COMPLETE_QUEST, async (event, questId) => {
    try {
      await ensureGamificationLoaded();
      // This would typically be handled automatically by the gamification service
      // but we can expose it for manual testing or special cases
      const data = gamificationService.getData();
      const quest = data.quests.find(q => q.id === questId);
      
      if (quest && !quest.isCompleted) {
        quest.isCompleted = true;
        quest.completedAt = Date.now();
        
        // Award quest rewards
        if (quest.reward.type === 'points') {
          await gamificationService.awardPoints(
            quest.reward.value as number,
            'quest_completion',
            `Completed quest: ${quest.name}`,
            { questId }
          );
        }
        
        return { success: true, data: quest };
      } else {
        return { success: false, error: 'Quest not found or already completed.' };
      }
    } catch (error) {
      console.error('[IPC] Complete quest error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Earn a badge (typically called internally)
  ipcMain.handle(IPC_CHANNELS.EARN_BADGE, async (event, badgeId) => {
    try {
      await ensureGamificationLoaded();
      const data = gamificationService.getData();
      const badge = data.badges.find(b => b.id === badgeId);
      
      if (badge && !badge.earnedAt) {
        badge.earnedAt = Date.now();
        
        // Send OS notification for badge earned
        await sendAchievementNotification(
          `🏅 Badge Unlocked: ${badge.name}!`,
          `${badge.icon} ${badge.description}`
        );
        
        // Also notify UI about badge earned
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window: BrowserWindow) => {
          window.webContents.send('badge-earned', badge);
        });
        
        return { success: true, data: badge };
      } else {
        return { success: false, error: 'Badge not found or already earned.' };
      }
    } catch (error) {
      console.error('[IPC] Earn badge error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Check first time settings open
  ipcMain.handle(IPC_CHANNELS.CHECK_FIRST_TIME_SETTINGS, async () => {
    try {
      const earnedBadge = await gamificationService.checkFirstTimeSettingsOpen();
      
      if (earnedBadge) {
        // Send OS notification for badge earned
        await sendAchievementNotification(
          `🏅 Badge Unlocked: ${earnedBadge.name}!`,
          `${earnedBadge.icon} ${earnedBadge.description} (+1 point)`
        );
        
        // Also notify UI about badge earned
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window: BrowserWindow) => {
          window.webContents.send('badge-earned', earnedBadge);
        });
        
        return { success: true, data: { badge: earnedBadge, firstTime: true } };
      } else {
        return { success: true, data: { badge: null, firstTime: false } };
      }
    } catch (error) {
      console.error('[IPC] Check first time settings error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 