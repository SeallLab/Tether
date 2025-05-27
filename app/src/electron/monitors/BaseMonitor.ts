import { ActivityLogger } from '../services/ActivityLogger.js';

export abstract class BaseMonitor {
  protected logger: ActivityLogger;
  protected isRunning: boolean = false;
  protected intervalId?: NodeJS.Timeout;

  constructor(logger: ActivityLogger) {
    this.logger = logger;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getName(): string;

  protected setInterval(callback: () => void, interval: number): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(callback, interval);
  }

  protected clearInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  public getStatus(): { name: string; running: boolean } {
    return {
      name: this.getName(),
      running: this.isRunning
    };
  }
} 