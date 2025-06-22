import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { ActivityLogger } from './ActivityLogger.js';
import { BaseMonitor } from '../monitors/BaseMonitor.js';
import { IdleMonitor } from '../monitors/IdleMonitor.js';
import { WindowMonitor } from '../monitors/WindowMonitor.js';
import { LLMService, createLLMService } from './LLMService.js';
import { NotificationService } from './NotificationService.js';
import { ChatService } from './ChatService.js';
import { SettingsService } from './SettingsService.js';
import { WorkPatternAnalyzer } from './WorkPatternAnalyzer.js';
import { GamificationService } from './GamificationService.js';
import { FocusRewardService } from './FocusRewardService.js';
import { MonitoringConfig, ActivityType, FocusNotificationData } from '../../shared/types.js';
import { IPC_CHANNELS } from '../../shared/constants.js';

export class ActivityMonitoringService {
  private logger: ActivityLogger;
  private monitors: Map<string, BaseMonitor> = new Map();
  private config: MonitoringConfig;
  private isStarted: boolean = false;
  private llmService: LLMService | null = null;
  private notificationService: NotificationService;
  private chatService: ChatService;
  public settingsService: SettingsService;
  private workPatternAnalyzer: WorkPatternAnalyzer;
  private gamificationService: GamificationService;
  private focusRewardService: FocusRewardService;
  private lastIdleNotification: number = 0;
  private lastGoodJobNotification: number = 0;
  private workCheckInterval: NodeJS.Timeout | null = null;

  constructor(settingsService: SettingsService, config?: Partial<MonitoringConfig>) {
    this.settingsService = settingsService;
    
    // Load configuration from settings service or use provided config
    if (settingsService.isSettingsLoaded()) {
      this.config = settingsService.getMonitoringConfig();
    } else {
      // Fallback to provided config or defaults - use consistent path with SettingsService
      this.config = {
        idle_enabled: true,
        screen_enabled: false,
        window_enabled: true,
        idle_threshold: 300,
        log_batch_size: 100,
        storage_path: path.join(app.getPath('userData'), 'activity_logs'),
        ...config
      };
    }

    // Initialize logger
    this.logger = new ActivityLogger(
      this.config.storage_path,
      this.config.log_batch_size
    );

    // Initialize notification service
    this.notificationService = new NotificationService();

    // Initialize chat service (PythonServerService will be injected later)
    this.chatService = new ChatService(this.logger);

    // Initialize work pattern analyzer
    this.workPatternAnalyzer = new WorkPatternAnalyzer();

    // Initialize gamification service
    this.gamificationService = new GamificationService();

    // Initialize focus reward service
    this.focusRewardService = new FocusRewardService(
      this.gamificationService,
      this.notificationService,
      this.logger
    );

    this.initializeMonitors();
    
    // Initialize LLM with saved settings
    this.initializeLLMFromSettings();
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

      // Request notification permissions
      await this.notificationService.requestPermissions();

      // Start all enabled monitors
      const startPromises = Array.from(this.monitors.values()).map(monitor => 
        monitor.start().catch(error => 
          console.error(`Failed to start ${monitor.getName()}:`, error)
        )
      );

      await Promise.allSettled(startPromises);

      this.isStarted = true;
      console.log('[ActivityMonitoringService] Activity monitoring started successfully');

      // Load gamification data
      await this.gamificationService.load();

      // Start focus reward monitoring
      await this.focusRewardService.startMonitoring();

      // Start work pattern monitoring (check every 5 minutes)
      this.startWorkPatternMonitoring();

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

      // Stop work pattern monitoring
      this.stopWorkPatternMonitoring();

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

  public async updateConfig(newConfig: Partial<MonitoringConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    console.log('[ActivityMonitoringService] Configuration updated:', newConfig);
    
    // Persist configuration changes
    try {
      await this.settingsService.updateMonitoringConfig(this.config);
      console.log('[ActivityMonitoringService] Configuration persisted to disk');
    } catch (error) {
      console.error('[ActivityMonitoringService] Failed to persist configuration:', error);
    }
    
    // Apply configuration changes to running monitors
    await this.applyConfigChanges(oldConfig, this.config);
  }

  private async applyConfigChanges(oldConfig: MonitoringConfig, newConfig: MonitoringConfig): Promise<void> {
    console.log('[ActivityMonitoringService] Applying configuration changes to monitors...');

    // Handle idle monitor changes
    if (oldConfig.idle_enabled !== newConfig.idle_enabled || 
        oldConfig.idle_threshold !== newConfig.idle_threshold) {
      
      const idleMonitor = this.monitors.get('idle') as any; // Cast to access updateThreshold
      
      if (newConfig.idle_enabled && !oldConfig.idle_enabled) {
        // Idle monitoring was enabled
        console.log('[ActivityMonitoringService] Enabling idle monitoring');
        if (!idleMonitor) {
          // Create new idle monitor
          const newIdleMonitor = new IdleMonitor(
            this.logger, 
            newConfig.idle_threshold
          );
          newIdleMonitor.onIdleStateChange = (isIdle: boolean, duration: number) => {
            this.handleIdleStateChange(isIdle, duration);
          };
          this.monitors.set('idle', newIdleMonitor);
          
          // Start it if the service is running
          if (this.isStarted) {
            await newIdleMonitor.start();
          }
        }
      } else if (!newConfig.idle_enabled && oldConfig.idle_enabled) {
        // Idle monitoring was disabled
        console.log('[ActivityMonitoringService] Disabling idle monitoring');
        if (idleMonitor) {
          await idleMonitor.stop();
          this.monitors.delete('idle');
        }
      } else if (newConfig.idle_enabled && idleMonitor && 
                 oldConfig.idle_threshold !== newConfig.idle_threshold) {
        // Threshold changed for existing monitor
        console.log(`[ActivityMonitoringService] Updating idle threshold from ${oldConfig.idle_threshold}s to ${newConfig.idle_threshold}s`);
        if (idleMonitor.updateThreshold) {
          idleMonitor.updateThreshold(newConfig.idle_threshold);
        }
      }
    }

    // Handle window monitor changes
    if (oldConfig.window_enabled !== newConfig.window_enabled) {
      const windowMonitor = this.monitors.get('window');
      
      if (newConfig.window_enabled && !oldConfig.window_enabled) {
        // Window monitoring was enabled
        console.log('[ActivityMonitoringService] Enabling window monitoring');
        if (!windowMonitor) {
          const newWindowMonitor = new WindowMonitor(this.logger);
          this.monitors.set('window', newWindowMonitor);
          
          // Start it if the service is running
          if (this.isStarted) {
            await newWindowMonitor.start();
          }
        }
      } else if (!newConfig.window_enabled && oldConfig.window_enabled) {
        // Window monitoring was disabled
        console.log('[ActivityMonitoringService] Disabling window monitoring');
        if (windowMonitor) {
          await windowMonitor.stop();
          this.monitors.delete('window');
        }
      }
    }

    console.log('[ActivityMonitoringService] Configuration changes applied successfully');
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
        await this.sendFocusNotificationToUI(llmResponse);
        
        console.log('[ActivityMonitoringService] Focus notification sent:', llmResponse.message);
      } else {
        console.log('[ActivityMonitoringService] LLM determined no notification needed');
      }
      
    } catch (error) {
      console.error('[ActivityMonitoringService] Error in LLM focus analysis:', error);
    }
  }

  private async sendFocusNotificationToUI(llmResponse: any): Promise<void> {
    // Send system notification
    try {
      await this.notificationService.sendFocusNotification(llmResponse);
      console.log('[ActivityMonitoringService] System notification sent successfully');
    } catch (error) {
      console.error('[ActivityMonitoringService] Failed to send system notification:', error);
    }

    // Send to UI via IPC (keep existing functionality)
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

  public getChatService(): ChatService {
    return this.chatService;
  }

  public getNotificationService(): NotificationService {
    return this.notificationService;
  }

  public getGamificationService(): GamificationService {
    return this.gamificationService;
  }

  public getFocusRewardService(): FocusRewardService {
    return this.focusRewardService;
  }

  private initializeLLMFromSettings(): void {
    if (this.settingsService.isSettingsLoaded()) {
      const llmSettings = this.settingsService.getLLMSettings();
      if (llmSettings.apiKey) {
        console.log('[ActivityMonitoringService] Initializing LLM with saved API key');
        this.initializeLLM(llmSettings.apiKey);
      } else {
        console.log('[ActivityMonitoringService] No saved API key, using mock provider');
        this.initializeLLM();
      }
    }
  }

  private startWorkPatternMonitoring(): void {
    // Check for consistent work every 5 minutes
    this.workCheckInterval = setInterval(async () => {
      await this.checkForConsistentWork();
    }, 5 * 60 * 1000);

    console.log('[ActivityMonitoringService] Work pattern monitoring started');
  }

  private stopWorkPatternMonitoring(): void {
    if (this.workCheckInterval) {
      clearInterval(this.workCheckInterval);
      this.workCheckInterval = null;
      console.log('[ActivityMonitoringService] Work pattern monitoring stopped');
    }
  }

  private async checkForConsistentWork(): Promise<void> {
    try {
      // Get the idle threshold from config (this is our "consistent work" threshold)
      const workThresholdMinutes = Math.floor(this.config.idle_threshold / 60);
      
      // Get recent logs for analysis
      const recentLogs = await this.logger.getRecentLogs(workThresholdMinutes + 10);
      
      // Check if user has been consistently working
      const workAnalysis = this.workPatternAnalyzer.hasBeenConsistentlyWorking(
        recentLogs,
        workThresholdMinutes,
        5 // Max 5 minute idle gaps allowed
      );

      if (workAnalysis.isConsistent) {
        // Prevent spam notifications (min 30 minutes between good job messages)
        const now = Date.now();
        if (now - this.lastGoodJobNotification < 30 * 60 * 1000) {
          return;
        }

        console.log(`[ActivityMonitoringService] Consistent work detected: ${workAnalysis.workDuration} minutes on ${workAnalysis.primaryActivity}`);
        
        // Analyze work pattern for contextual message
        const workPattern = this.workPatternAnalyzer.analyzeWorkPattern(recentLogs, workThresholdMinutes);
        const encouragementMessage = this.workPatternAnalyzer.generateEncouragementMessage(
          workPattern,
          workAnalysis.workDuration
        );

        // Send good job notification
        await this.notificationService.sendGoodJobNotification(
          encouragementMessage,
          workAnalysis.workDuration,
          workAnalysis.primaryActivity
        );

        this.lastGoodJobNotification = now;
        console.log('[ActivityMonitoringService] Good job notification sent:', encouragementMessage);
      }
    } catch (error) {
      console.error('[ActivityMonitoringService] Error checking for consistent work:', error);
    }
  }
} 