import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { ActivityLogger } from './ActivityLogger.js';
import { BaseMonitor } from '../monitors/BaseMonitor.js';
import { IdleMonitor } from '../monitors/IdleMonitor.js';
import { WindowMonitor } from '../monitors/WindowMonitor.js';
import { LLMService, createLLMService } from './LLMService.js';
import { MonitoringConfig, ActivityType, FocusNotificationData } from '../../shared/types.js';
import { IPC_CHANNELS } from '../../shared/constants.js';

export class ActivityMonitoringService {
  private logger: ActivityLogger;
  private monitors: Map<string, BaseMonitor> = new Map();
  private config: MonitoringConfig;
  private isStarted: boolean = false;
  private llmService: LLMService | null = null;
  private lastIdleNotification: number = 0;

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
      
      // Subscribe to idle events for LLM analysis
      idleMonitor.onIdleStateChange = (isIdle: boolean, duration: number) => {
        this.handleIdleStateChange(isIdle, duration);
      };
      
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

  private async handleIdleStateChange(isIdle: boolean, duration: number): Promise<void> {
    // Only trigger LLM analysis when user becomes idle (not when they return)
    if (!isIdle || !this.llmService) return;
    
    // Prevent spam notifications (min 10 minutes between notifications)
    const now = Date.now();
    if (now - this.lastIdleNotification < 10 * 60 * 1000) {
      console.log('[ActivityMonitoringService] Skipping LLM analysis - too soon since last notification');
      return;
    }

    try {
      console.log(`[ActivityMonitoringService] User idle for ${duration}s, analyzing with LLM...`);
      
      // Get today's logs for context
      const todayLogs = await this.logger.getRecentLogs(12 * 60); // Last 12 hours
      
      // Analyze focus loss with LLM
      const llmResponse = await this.llmService.analyzeFocusLoss(duration, todayLogs);
      
      if (llmResponse.should_notify) {
        this.lastIdleNotification = now;
        
        // Create focus notification log entry
        const focusNotification: FocusNotificationData = {
          trigger: 'idle_threshold_reached',
          idle_duration: duration,
          last_activity: this.getLastActivityDescription(todayLogs),
          message: llmResponse.message,
          should_notify: llmResponse.should_notify,
          context: {
            recent_windows: this.extractRecentWindows(todayLogs),
            session_duration: this.getSessionDuration(todayLogs),
            focus_loss_reason: llmResponse.reasoning
          }
        };

        // Log the focus notification
        this.logger.log(ActivityType.FOCUS_NOTIFICATION, focusNotification);
        
        // Send to UI via IPC
        this.sendFocusNotificationToUI(llmResponse);
        
        console.log('[ActivityMonitoringService] Focus notification sent:', llmResponse.message);
      } else {
        console.log('[ActivityMonitoringService] LLM determined no notification needed');
      }
      
    } catch (error) {
      console.error('[ActivityMonitoringService] Error in LLM focus analysis:', error);
    }
  }

  private sendFocusNotificationToUI(llmResponse: any): void {
    // Send to all windows (in case multiple are open)
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window: BrowserWindow) => {
      window.webContents.send(IPC_CHANNELS.FOCUS_NOTIFICATION, llmResponse);
    });
  }

  private getLastActivityDescription(logs: any[]): string {
    const lastWindowChange = logs
      .filter(log => log.type === 'window_change')
      .pop();
    
    if (lastWindowChange) {
      const data = lastWindowChange.data;
      return `${data.application_name}: ${data.window_title}`;
    }
    
    return 'Unknown activity';
  }

  private extractRecentWindows(logs: any[]): string[] {
    return logs
      .filter(log => log.type === 'window_change')
      .slice(-5)
      .map(log => `${log.data.application_name}: ${log.data.window_title}`);
  }

  private getSessionDuration(logs: any[]): number {
    if (logs.length === 0) return 0;
    const start = Math.min(...logs.map(log => log.timestamp));
    const end = Math.max(...logs.map(log => log.timestamp));
    return end - start;
  }

  // Method to initialize LLM service
  public initializeLLM(apiKey?: string): void {
    try {
      if (apiKey) {
        // Use Gemini with API key
        this.llmService = createLLMService(this.logger, 'gemini', { apiKey });
        console.log('[ActivityMonitoringService] LLM service initialized with Gemini');
      } else {
        // Use mock provider as fallback
        this.llmService = createLLMService(this.logger, 'mock');
        console.log('[ActivityMonitoringService] LLM service initialized with Mock provider');
      }
    } catch (error) {
      console.error('[ActivityMonitoringService] Failed to initialize LLM service:', error);
      // Fallback to mock provider
      try {
        this.llmService = createLLMService(this.logger, 'mock');
        console.log('[ActivityMonitoringService] Fallback: LLM service initialized with Mock provider');
      } catch (fallbackError) {
        console.error('[ActivityMonitoringService] Failed to initialize fallback LLM service:', fallbackError);
      }
    }
  }

  public getLLMStatus(): { enabled: boolean; provider?: string } {
    return {
      enabled: this.llmService !== null,
      provider: this.llmService?.getCurrentProvider()
    };
  }
} 