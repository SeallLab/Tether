import { powerMonitor } from 'electron';
import { BaseMonitor } from './BaseMonitor.js';
import { ActivityType, IdleData } from '../../shared/types.js';

export class IdleMonitor extends BaseMonitor {
  private idleThreshold: number;
  private lastActivityTime: number;
  private wasIdle: boolean = false;

  constructor(logger: any, idleThreshold: number = 300) { // 5 minutes default
    super(logger);
    this.idleThreshold = idleThreshold;
    this.lastActivityTime = Date.now();
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[IdleMonitor] Starting idle monitoring...');
    this.isRunning = true;

    // Monitor for resume from suspend/sleep
    powerMonitor.on('resume', () => {
      this.handleResume('unknown');
    });

    // Check idle status every 30 seconds
    this.setInterval(() => {
      this.checkIdleStatus();
    }, 30000);

    // Listen for activity to reset idle timer
    this.resetIdleTimer();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[IdleMonitor] Stopping idle monitoring...');
    this.isRunning = false;
    this.clearInterval();
    powerMonitor.removeAllListeners('resume');
  }

  public getName(): string {
    return 'IdleMonitor';
  }

  private checkIdleStatus(): void {
    const currentTime = Date.now();
    const idleDuration = (currentTime - this.lastActivityTime) / 1000; // in seconds

    if (idleDuration >= this.idleThreshold && !this.wasIdle) {
      // User just became idle
      this.wasIdle = true;
      this.logIdleEvent(idleDuration, true, 'unknown');
    } else if (idleDuration < this.idleThreshold && this.wasIdle) {
      // User resumed activity
      this.wasIdle = false;
      this.logIdleEvent(idleDuration, false, 'unknown');
    }
  }

  private resetIdleTimer(): void {
    this.lastActivityTime = Date.now();
    if (this.wasIdle) {
      this.wasIdle = false;
      this.logIdleEvent(0, false, 'unknown');
    }
  }

  private handleResume(trigger: 'mouse' | 'keyboard' | 'unknown'): void {
    const currentTime = Date.now();
    const idleDuration = (currentTime - this.lastActivityTime) / 1000;
    
    this.logIdleEvent(idleDuration, false, trigger);
    this.resetIdleTimer();
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
    } else {
      this.resetIdleTimer();
    }
  }
} 