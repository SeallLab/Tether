import { Notification, NotificationConstructorOptions, app } from 'electron';
import { LLMResponse } from '../../shared/types.js';
import { NotificationTracker } from './NotificationTracker.js';
import { injectable } from 'tsyringe';
import { Logger } from '../utils/Logger.js';

@injectable()
export class NotificationService {
  private isSupported: boolean;
  private tracker: NotificationTracker;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ name: 'NotificationService' });
    this.isSupported = Notification.isSupported();
    this.tracker = new NotificationTracker();
    
    if (!this.isSupported) {
      this.logger.warn('System notifications not supported on this platform');
    }
  }

  /**
   * Send a focus notification based on LLM response
   */
  public async sendFocusNotification(llmResponse: LLMResponse): Promise<void> {
    if (!this.isSupported) {
      this.logger.warn('Cannot send notification - not supported');
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

    } catch (error) {
      this.logger.error('Failed to send focus notification:', error);
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
          resolve();
        });

        notification.on('click', () => {
          if (notificationId) {
            this.tracker.recordInteraction(notificationId, { clicked: true });
          }
          // You could add logic here to bring the app to focus
        });

        notification.on('close', () => {
          if (notificationId) {
            this.tracker.recordInteraction(notificationId, { dismissed: true });
          }
        });

        notification.on('failed', (error) => {
          this.logger.error('Notification failed:', error);
          reject(error);
        });

        // Show the notification
        notification.show();

      } catch (error) {
        this.logger.error('Error creating notification:', error);
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
      this.logger.warn('Cannot send notification - not supported');
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
    } catch (error) {
      this.logger.error('Failed to send good job notification:', error);
    }
  }

  /**
   * Check if notifications are supported
   */
  public isNotificationSupported(): boolean {
    return this.isSupported;
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