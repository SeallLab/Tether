import { Notification, NotificationConstructorOptions, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LLMResponse } from '../../shared/types.js';
import { NotificationTracker, NotificationRecord } from './NotificationTracker.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

export class NotificationService {
  private isSupported: boolean;
  private tracker: NotificationTracker;

  constructor() {
    this.isSupported = Notification.isSupported();
    this.tracker = new NotificationTracker();
    
    if (!this.isSupported) {
      console.warn('[NotificationService] System notifications not supported on this platform');
    } else {
      console.log('[NotificationService] System notifications supported');
    }
  }

  /**
   * Send a focus notification based on LLM response
   */
  public async sendFocusNotification(llmResponse: LLMResponse): Promise<void> {
    if (!this.isSupported) {
      console.warn('[NotificationService] Cannot send notification - not supported');
      return;
    }

    // Check if we should send this notification
    if (!this.tracker.shouldSendNotification('idle_warning', 10)) {
      return;
    }

    try {
      const options: NotificationConstructorOptions = {
        title: 'Time to Focus!',
        body: llmResponse.message,
        silent: false,
        urgency: 'normal'
      };

      const notificationId = await this.tracker.recordNotification(
        'idle_warning',
        llmResponse.message,
        {
          trigger_reason: 'idle_threshold_reached'
        }
      );

      await this.sendNotification(options, notificationId);
      console.log('[NotificationService] Focus notification sent successfully');

    } catch (error) {
      console.error('[NotificationService] Failed to send focus notification:', error);
    }
  }

  /**
   * Send a custom notification
   */
  public async sendNotification(options: NotificationConstructorOptions, notificationId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          silent: options.silent || false,
          urgency: options.urgency || 'normal'
        });

        notification.on('show', () => {
          console.log('[NotificationService] Notification shown');
          resolve();
        });

        notification.on('click', () => {
          console.log('[NotificationService] Notification clicked');
          if (notificationId) {
            this.tracker.recordInteraction(notificationId, { clicked: true });
          }
          // You could add logic here to bring the app to focus
        });

        notification.on('close', () => {
          console.log('[NotificationService] Notification closed');
          if (notificationId) {
            this.tracker.recordInteraction(notificationId, { dismissed: true });
          }
        });

        notification.on('failed', (error) => {
          console.error('[NotificationService] Notification failed:', error);
          reject(error);
        });

        // Show the notification
        notification.show();

      } catch (error) {
        console.error('[NotificationService] Error creating notification:', error);
        reject(error);
      }
    });
  }

  /**
   * Send a "good job" encouragement notification
   */
  public async sendGoodJobNotification(
    message: string,
    workDuration: number,
    recentActivity: string
  ): Promise<void> {
    if (!this.isSupported) {
      console.warn('[NotificationService] Cannot send notification - not supported');
      return;
    }

    // Check if we should send this notification (30 min cooldown for good job messages)
    if (!this.tracker.shouldSendNotification('good_job', 30)) {
      return;
    }

    try {
      const options: NotificationConstructorOptions = {
        title: 'Great Work! 🎉',
        body: message,
        silent: false,
        urgency: 'low' // Less intrusive than focus warnings
      };

      const notificationId = await this.tracker.recordNotification(
        'good_job',
        message,
        {
          work_duration: workDuration,
          recent_activity: recentActivity,
          trigger_reason: 'consistent_work_detected'
        }
      );

      await this.sendNotification(options, notificationId);
      console.log('[NotificationService] Good job notification sent successfully');

    } catch (error) {
      console.error('[NotificationService] Failed to send good job notification:', error);
    }
  }

  /**
   * Check if notifications are supported
   */
  public isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Request notification permissions (mainly for macOS)
   */
  public async requestPermissions(): Promise<boolean> {
    if (process.platform === 'darwin') {
      try {
        // On macOS, we need to request notification permissions
        console.log('[NotificationService] Requesting notification permissions on macOS');
        return true; // Electron handles this automatically
      } catch (error) {
        console.error('[NotificationService] Failed to request permissions:', error);
        return false;
      }
    }
    
    return true; // Other platforms don't require explicit permission requests
  }

  /**
   * Get notification statistics
   */
  public getNotificationStats() {
    return this.tracker.getStats();
  }

  /**
   * Get recent notifications
   */
  public getRecentNotifications(minutes: number = 60) {
    return this.tracker.getRecentNotifications(minutes);
  }

  /**
   * Clean up old notification records
   */
  public async cleanupNotifications(): Promise<void> {
    await this.tracker.cleanup();
  }
} 