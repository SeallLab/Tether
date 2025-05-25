import { Notification, NotificationConstructorOptions, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LLMResponse } from '../../shared/types.js';

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
  private appIcon: string;
  private isSupported: boolean;

  constructor() {
    this.isSupported = Notification.isSupported();
    this.appIcon = this.resolveIconPath();
    
    if (!this.isSupported) {
      console.warn('[NotificationService] System notifications not supported on this platform');
    } else {
      console.log('[NotificationService] System notifications supported');
    }
  }

  private resolveIconPath(): string {
    // Try to find app icon in different locations
    const possiblePaths = [
      path.join(app.getAppPath(), 'tether.png'),
      path.join(app.getAppPath(), 'assets', 'icon.png'),
      path.join(app.getAppPath(), 'dist', 'icon.png'),
      path.join(__dirname, '..', '..', '..', 'tether.png')
    ];

    // Return the first existing path or undefined
    for (const iconPath of possiblePaths) {
      try {
        // In a real implementation, you'd check if file exists
        return iconPath;
      } catch (error) {
        continue;
      }
    }

    return ''; // Fallback to system default
  }

  /**
   * Send a focus notification based on LLM response
   */
  public async sendFocusNotification(llmResponse: LLMResponse): Promise<void> {
    if (!this.isSupported) {
      console.warn('[NotificationService] Cannot send notification - not supported');
      return;
    }

    try {
      const options: NotificationConstructorOptions = {
        title: 'Tether - Time to Focus!',
        body: llmResponse.message,
        icon: this.appIcon,
        silent: false,
        urgency: 'normal'
      };

      await this.sendNotification(options);
      console.log('[NotificationService] Focus notification sent successfully');

    } catch (error) {
      console.error('[NotificationService] Failed to send focus notification:', error);
    }
  }

  /**
   * Send a custom notification
   */
  public async sendNotification(options: NotificationConstructorOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: options.icon || this.appIcon,
          silent: options.silent || false,
          urgency: options.urgency || 'normal'
        });

        notification.on('show', () => {
          console.log('[NotificationService] Notification shown');
          resolve();
        });

        notification.on('click', () => {
          console.log('[NotificationService] Notification clicked');
          // You could add logic here to bring the app to focus
        });

        notification.on('close', () => {
          console.log('[NotificationService] Notification closed');
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
} 