import { Notification, BrowserWindow } from 'electron';

export class NotificationManager {
  private startupNotificationTimer: NodeJS.Timeout | null = null;
  private getMainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  scheduleStartupNotification(delayMs: number = 30000): void {
    this.startupNotificationTimer = setTimeout(() => {
      this.showDailyPlanNotification();
    }, delayMs);
  }

  showDailyPlanNotification(): void {
    if (!Notification.isSupported()) {
      console.log('[NotificationManager] Notifications not supported on this system');
      return;
    }

    // Create notification options without icon for now (can be added later)
    const notificationOptions: Electron.NotificationConstructorOptions = {
      title: 'Daily Planning',
      body: "What's your plan for today? Click to share your goals and priorities.",
      silent: false
    };

    // Only add urgency on Linux (not supported on all platforms)
    if (process.platform === 'linux') {
      (notificationOptions as any).urgency = 'normal';
    }

    const notification = new Notification(notificationOptions);

    notification.on('click', () => {
      console.log('[NotificationManager] Daily plan notification clicked');
      const mainWindow = this.getMainWindow();
      if (mainWindow) {
        // Send message to main window to show chat dialog
        mainWindow.webContents.send('show-chat-dialog', 'daily-plan');
        // Show the main window if it's hidden
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  }

  clearStartupTimer(): void {
    if (this.startupNotificationTimer) {
      clearTimeout(this.startupNotificationTimer);
      this.startupNotificationTimer = null;
    }
  }
} 