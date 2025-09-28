import { Notification, app, NotificationConstructorOptions } from 'electron';
import { injectable, inject } from 'tsyringe';
import { WindowManager } from './WindowManager.js';
import { Logger } from '../utils/Logger.js';

@injectable()
export class NotificationManager {
  private startupNotificationTimer: NodeJS.Timeout | null = null;
  private windowManager: WindowManager;
  private logger: Logger;
  
  constructor(@inject(WindowManager) windowManager: WindowManager) {
    this.windowManager = windowManager;
    this.logger = new Logger({ name: 'NotificationManager' });
  }

  scheduleStartupNotification(delayMs: number = 30000): void {
    this.startupNotificationTimer = setTimeout(() => {
      this.showDailyPlanNotification();
    }, delayMs);
  }

  showDailyPlanNotification(): void {
    if (!Notification.isSupported()) {
      this.logger.info('Notifications not supported on this system');
      return;
    }

    const notificationOptions: NotificationConstructorOptions = {
      title: 'Daily Planning',
      body: "What's your plan for today? Click to share your goals and priorities.",
      silent: false
    };

    // Only add urgency on Linux (not supported on all platforms)
    if (process.platform === 'linux') {
      notificationOptions.urgency = 'normal';
    }

    const notification = new Notification(notificationOptions);

    notification.on('click', () => {
      this.logger.info('Daily plan notification clicked');
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        // Send message to main window to show chat dialog
        mainWindow.webContents.send('show-chat-dialog', 'daily-plan');
        app.focus({ steal: true });
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