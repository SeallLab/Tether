import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ActivityLog, ActivityType, ActivityData } from '../../shared/types.js';
import { inject, injectable } from 'tsyringe';
import { SettingsService } from './SettingsService.js';

@injectable()
export class ActivityLogger {
  private logs: ActivityLog[] = [];
  private sessionId: string;
  private settingsService: SettingsService;

  constructor(@inject(SettingsService) settingsService: SettingsService,) {
    this.settingsService = settingsService;
    this.sessionId = uuidv4();
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.settingsService.getMonitoringConfig().storage_path, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  public log(type: ActivityType, data: ActivityData): void {
    const logEntry: ActivityLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      data,
      session_id: this.sessionId
    };

    this.logs.push(logEntry);

    // Auto-flush when batch size is reached
    if (this.logs.length >= this.settingsService.getMonitoringConfig().log_batch_size) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.logs.length === 0) return;

    try {
      const filename = `activity_${new Date().toISOString().split('T')[0]}.jsonl`;
      const filepath = path.join(this.settingsService.getMonitoringConfig().storage_path, filename);
      
      // Convert logs to JSONL format (one JSON object per line)
      const jsonlData = this.logs.map(log => JSON.stringify(log)).join('\n') + '\n';
      
      await fs.appendFile(filepath, jsonlData, 'utf8');
      
      this.logs = []; // Clear the buffer
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  public async getLogsByDateRange(startDate: Date, endDate: Date): Promise<ActivityLog[]> {
    const logs: ActivityLog[] = [];
    
    try {
      const files = await fs.readdir(this.settingsService.getMonitoringConfig().storage_path);
      const logFiles = files.filter(file => file.startsWith('activity_') && file.endsWith('.jsonl'));

      for (const file of logFiles) {
        const filepath = path.join(this.settingsService.getMonitoringConfig().storage_path, file);
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const log: ActivityLog = JSON.parse(line);
              const logDate = new Date(log.timestamp);
              
              if (logDate >= startDate && logDate <= endDate) {
                logs.push(log);
              }
            } catch (parseError) {
              console.warn('Failed to parse log line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to read logs:', error);
    }

    return logs.sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getRecentLogs(minutes: number = 60): Promise<ActivityLog[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (minutes * 60 * 1000));
    return this.getLogsByDateRange(startDate, endDate);
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async cleanup(): Promise<void> {
    await this.flush();
  }
} 