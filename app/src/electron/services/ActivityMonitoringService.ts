import { app } from 'electron';
import path from 'path';
import os from 'os';
import { ActivityLogger } from './ActivityLogger.js';
import { BaseMonitor } from '../monitors/BaseMonitor.js';
import { IdleMonitor } from '../monitors/IdleMonitor.js';
import { WindowMonitor } from '../monitors/WindowMonitor.js';
import { MonitoringConfig } from '../../shared/types.js';

export class ActivityMonitoringService {
  private logger: ActivityLogger;
  private monitors: Map<string, BaseMonitor> = new Map();
  private config: MonitoringConfig;
  private isStarted: boolean = false;

  constructor(config?: Partial<MonitoringConfig>) {
    // Default configuration
    this.config = {
      typing_enabled: true,
      mouse_enabled: true,
      idle_enabled: true,
      screen_enabled: false, // Disabled by default due to privacy concerns
      window_enabled: true,
      screenshot_interval: 300, // 5 minutes
      idle_threshold: 300, // 5 minutes
      log_batch_size: 100,
      storage_path: path.join(os.homedir(), '.tether', 'activity_logs'),
      ...config
    };

    // Initialize logger
    this.logger = new ActivityLogger(
      this.config.storage_path,
      this.config.log_batch_size
    );

    this.initializeMonitors();
  }

  private initializeMonitors(): void {
    // Initialize idle monitor
    if (this.config.idle_enabled) {
      const idleMonitor = new IdleMonitor(this.logger, this.config.idle_threshold);
      this.monitors.set('idle', idleMonitor);
    }

    // Initialize window monitor
    if (this.config.window_enabled) {
      const windowMonitor = new WindowMonitor(this.logger);
      this.monitors.set('window', windowMonitor);
    }

    // Note: Typing and Mouse monitors would require additional native modules
    // For now, we're implementing the foundation with Idle and Window monitoring
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      console.log('[ActivityMonitoringService] Already started');
      return;
    }

    console.log('[ActivityMonitoringService] Starting activity monitoring...');
    
    try {
      // Request necessary permissions
      await this.requestPermissions();

      // Start all enabled monitors
      const startPromises = Array.from(this.monitors.values()).map(monitor => 
        monitor.start().catch(error => 
          console.error(`Failed to start ${monitor.getName()}:`, error)
        )
      );

      await Promise.allSettled(startPromises);

      this.isStarted = true;
      console.log('[ActivityMonitoringService] Activity monitoring started successfully');

      // Set up cleanup on app quit
      app.on('before-quit', async () => {
        await this.stop();
      });

    } catch (error) {
      console.error('[ActivityMonitoringService] Failed to start:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) return;

    console.log('[ActivityMonitoringService] Stopping activity monitoring...');

    try {
      // Stop all monitors
      const stopPromises = Array.from(this.monitors.values()).map(monitor => 
        monitor.stop().catch(error => 
          console.error(`Failed to stop ${monitor.getName()}:`, error)
        )
      );

      await Promise.allSettled(stopPromises);

      // Cleanup logger
      await this.logger.cleanup();

      this.isStarted = false;
      console.log('[ActivityMonitoringService] Activity monitoring stopped');

    } catch (error) {
      console.error('[ActivityMonitoringService] Error during shutdown:', error);
    }
  }

  public getStatus(): { 
    started: boolean; 
    sessionId: string; 
    monitors: Array<{ name: string; running: boolean }>;
    config: MonitoringConfig;
  } {
    return {
      started: this.isStarted,
      sessionId: this.logger.getSessionId(),
      monitors: Array.from(this.monitors.values()).map(monitor => monitor.getStatus()),
      config: this.config
    };
  }

  public async getRecentActivity(minutes: number = 60): Promise<any[]> {
    return await this.logger.getRecentLogs(minutes);
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ActivityMonitoringService] Configuration updated:', newConfig);
  }

  private async requestPermissions(): Promise<void> {
    console.log('[ActivityMonitoringService] Requesting necessary permissions...');
    
    if (process.platform === 'darwin') {
      // On macOS, we need to request accessibility permissions
      // This will be shown to the user in System Preferences
      console.log('[ActivityMonitoringService] macOS detected - accessibility permissions may be required');
      console.log('[ActivityMonitoringService] Please grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility');
    }

    // For screen monitoring, additional permissions would be needed
    if (this.config.screen_enabled) {
      console.log('[ActivityMonitoringService] Screen monitoring enabled - additional permissions may be required');
    }
  }

  public getLogger(): ActivityLogger {
    return this.logger;
  }

  public getMonitor(name: string): BaseMonitor | undefined {
    return this.monitors.get(name);
  }

  // Helper method to manually trigger activity logging (useful for testing)
  public async triggerManualLog(type: string, data: any): Promise<void> {
    if (this.isStarted) {
      console.log(`[ActivityMonitoringService] Manual log triggered: ${type}`, data);
      // This would be implemented with the appropriate activity type
    }
  }
} 