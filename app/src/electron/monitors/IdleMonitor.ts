import { powerMonitor } from 'electron';
import { BaseMonitor } from './BaseMonitor.js';
import { ActivityType, IdleData } from '../../shared/types.js';

export class IdleMonitor extends BaseMonitor {
  private idleThreshold: number;
  private wasIdle: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(logger: any, idleThreshold: number = 300) { // 300 seconds (5 minutes) default
    super(logger);
    this.idleThreshold = idleThreshold;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log(`[IdleMonitor] Starting idle monitoring with threshold: ${this.idleThreshold} seconds...`);
    this.isRunning = true;

    // Monitor for resume from suspend/sleep
    powerMonitor.on('resume', () => {
      this.handleResume('unknown');
    });

    // Check idle status every 5 seconds using system idle time
    this.checkInterval = setInterval(() => {
      this.checkIdleStatus();
    }, 5000);

    // Initial check
    this.checkIdleStatus();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[IdleMonitor] Stopping idle monitoring...');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    powerMonitor.removeAllListeners('resume');
  }

  public getName(): string {
    return 'IdleMonitor';
  }

  private checkIdleStatus(): void {
    try {
      // Get system idle time in seconds
      const systemIdleTime = powerMonitor.getSystemIdleTime();
      console.log(`[IdleMonitor] System idle time: ${systemIdleTime}s, threshold: ${this.idleThreshold}s`);

      if (systemIdleTime >= this.idleThreshold && !this.wasIdle) {
        // User just became idle
        console.log('[IdleMonitor] User became idle');
        this.wasIdle = true;
        this.logIdleEvent(systemIdleTime, true, 'unknown');
      } else if (systemIdleTime < this.idleThreshold && this.wasIdle) {
        // User resumed activity
        console.log('[IdleMonitor] User resumed activity');
        this.wasIdle = false;
        this.logIdleEvent(systemIdleTime, false, 'unknown');
      }
    } catch (error) {
      console.error('[IdleMonitor] Error checking idle status:', error);
    }
  }

  private handleResume(trigger: 'mouse' | 'keyboard' | 'unknown'): void {
    console.log('[IdleMonitor] System resumed from sleep');
    
    if (this.wasIdle) {
      this.wasIdle = false;
      this.logIdleEvent(0, false, trigger);
    }
  }

  private logIdleEvent(duration: number, isIdle: boolean, trigger: 'mouse' | 'keyboard' | 'unknown'): void {
    const idleData: IdleData = {
      idle_duration: duration,
      was_idle: isIdle,
      resume_trigger: trigger
    };

    this.logger.log(ActivityType.IDLE, idleData);
  }

  // Public method to manually reset idle timer (can be called by other monitors)
  public notifyActivity(trigger: 'mouse' | 'keyboard' | 'unknown' = 'unknown'): void {
    if (this.wasIdle) {
      this.handleResume(trigger);
    }
  }
} 