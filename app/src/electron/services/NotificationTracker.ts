import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { injectable } from 'tsyringe';
export interface NotificationRecord {
  id: string;
  type: 'idle_warning' | 'good_job' | 'focus_reminder' | 'daily_plan';
  timestamp: number;
  message: string;
  context?: {
    idle_duration?: number;
    work_duration?: number;
    recent_activity?: string;
    trigger_reason?: string;
  };
  user_interaction?: {
    clicked?: boolean;
    dismissed?: boolean;
    interaction_timestamp?: number;
  };
}

export interface NotificationStats {
  total_sent: number;
  by_type: Record<string, number>;
  last_24h: number;
  last_week: number;
  avg_per_day: number;
}

@injectable()
export class NotificationTracker {
  private notifications: NotificationRecord[] = [];
  private storagePath: string;
  private logFilePath: string;

  constructor() {
    // Use userData directory for notification logs
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, 'notification_logs');
    this.logFilePath = path.join(this.storagePath, 'notifications.json');
    
    this.ensureStorageDirectory();
    this.loadNotifications();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('[NotificationTracker] Failed to create storage directory:', error);
    }
  }

  private async loadNotifications(): Promise<void> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      this.notifications = JSON.parse(data);
      console.log(`[NotificationTracker] Loaded ${this.notifications.length} notification records`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('[NotificationTracker] Failed to load notifications:', error);
      }
      this.notifications = [];
    }
  }

  private async saveNotifications(): Promise<void> {
    try {
      await fs.writeFile(
        this.logFilePath,
        JSON.stringify(this.notifications, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[NotificationTracker] Failed to save notifications:', error);
    }
  }

  /**
   * Record a new notification
   */
  public async recordNotification(
    type: NotificationRecord['type'],
    message: string,
    context?: NotificationRecord['context']
  ): Promise<string> {
    const notification: NotificationRecord = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      message,
      context
    };

    this.notifications.push(notification);
    await this.saveNotifications();
    
    console.log(`[NotificationTracker] Recorded ${type} notification:`, message);
    return notification.id;
  }

  /**
   * Record user interaction with a notification
   */
  public async recordInteraction(
    notificationId: string,
    interaction: NotificationRecord['user_interaction']
  ): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.user_interaction = {
        ...notification.user_interaction,
        ...interaction,
        interaction_timestamp: Date.now()
      };
      await this.saveNotifications();
    }
  }

  /**
   * Check if we should send a notification based on recent history
   */
  public shouldSendNotification(
    type: NotificationRecord['type'],
    cooldownMinutes: number = 30
  ): boolean {
    const now = Date.now();
    const cooldownMs = cooldownMinutes * 60 * 1000;

    // Check for recent notifications of the same type
    const recentNotifications = this.notifications.filter(n => 
      n.type === type && (now - n.timestamp) < cooldownMs
    );

    if (recentNotifications.length > 0) {
      console.log(`[NotificationTracker] Skipping ${type} notification - sent ${recentNotifications.length} in last ${cooldownMinutes} minutes`);
      return false;
    }

    // Additional spam protection: max 10 notifications per hour total
    const lastHourNotifications = this.notifications.filter(n => 
      (now - n.timestamp) < (60 * 60 * 1000)
    );

    if (lastHourNotifications.length >= 10) {
      console.log('[NotificationTracker] Skipping notification - too many sent in last hour');
      return false;
    }

    return true;
  }

  /**
   * Get notification statistics
   */
  public getStats(): NotificationStats {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    const last24h = this.notifications.filter(n => (now - n.timestamp) < day).length;
    const lastWeek = this.notifications.filter(n => (now - n.timestamp) < week).length;

    const byType: Record<string, number> = {};
    this.notifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    // Calculate average per day (based on first notification date)
    let avgPerDay = 0;
    if (this.notifications.length > 0) {
      const firstNotification = Math.min(...this.notifications.map(n => n.timestamp));
      const daysSinceFirst = Math.max(1, (now - firstNotification) / day);
      avgPerDay = this.notifications.length / daysSinceFirst;
    }

    return {
      total_sent: this.notifications.length,
      by_type: byType,
      last_24h: last24h,
      last_week: lastWeek,
      avg_per_day: Math.round(avgPerDay * 100) / 100
    };
  }

  /**
   * Get recent notifications for analysis
   */
  public getRecentNotifications(minutes: number = 60): NotificationRecord[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.notifications
      .filter(n => n.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clean up old notifications (keep last 30 days)
   */
  public async cleanup(): Promise<void> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const originalCount = this.notifications.length;
    
    this.notifications = this.notifications.filter(n => n.timestamp > thirtyDaysAgo);
    
    if (this.notifications.length < originalCount) {
      await this.saveNotifications();
      console.log(`[NotificationTracker] Cleaned up ${originalCount - this.notifications.length} old notifications`);
    }
  }
} 