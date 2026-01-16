import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import type { MonitoringConfig } from '../../shared/types.js';
import { injectable } from 'tsyringe';
import { Logger } from '../utils/Logger.js';

export interface AppSettings {
  monitoring: MonitoringConfig;
  llm: {
    apiKey?: string;
    provider?: string;
  };
  ui: {
    lastActiveTab?: string;
    windowPositions?: Record<string, { x: number; y: number; width: number; height: number }>;
  };
  general: {
    startAtLogin?: boolean;
    minimizeToTray?: boolean;
    showNotifications?: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  monitoring: {
    idle_enabled: true,
    screen_enabled: false,
    window_enabled: true,
    idle_threshold: 1200, // 20 minutes
    log_batch_size: 10,
    storage_path: '', // Will be set dynamically
  },
  llm: {
    provider: 'mock',
  },
  ui: {
    lastActiveTab: 'activity',
  },
  general: {
    startAtLogin: true,
    minimizeToTray: true,
    showNotifications: true,
  },
};

@injectable()
export class SettingsService {
  private settings: AppSettings;
  private settingsPath: string;
  private isLoaded: boolean = false;
  private logger: Logger;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
    this.settings.monitoring.storage_path = path.join(userDataPath, 'activity_logs');
    this.logger = new Logger({ name: 'SettingsService' });
    this.load();
  }

  /**
   * Load settings from disk
   */
  async load(): Promise<void> {
    try {
      // Ensure the userData directory exists
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });

      // Check if settings file exists
      try {
        await fs.access(this.settingsPath);
      } catch {
        // File doesn't exist, create it with defaults
        await this.save();
        this.isLoaded = true;
        return;
      }

      // Read and parse settings file
      const settingsData = await fs.readFile(this.settingsPath, 'utf8');
      const loadedSettings = JSON.parse(settingsData) as Partial<AppSettings>;

      // Merge with defaults to ensure all properties exist
      this.settings = this.mergeWithDefaults(loadedSettings);
      
      // Validate and migrate settings if needed
      await this.validateAndMigrate();
      
      this.isLoaded = true;
    } catch (error) {
      this.logger.error('Error loading settings:', error);
      // Fall back to defaults if loading fails
      this.settings = { ...DEFAULT_SETTINGS };
      this.settings.monitoring.storage_path = path.join(app.getPath('userData'), 'activity_logs');
      this.isLoaded = true;
    }
  }

  /**
   * Save settings to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      
      // Write settings to file with pretty formatting
      await fs.writeFile(
        this.settingsPath, 
        JSON.stringify(this.settings, null, 2), 
        'utf8'
      );
      
    } catch (error) {
      this.logger.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    if (!this.isLoaded) {
      throw new Error('Settings not loaded. Call load() first.');
    }
    return { ...this.settings };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return { ...this.settings.monitoring };
  }

  /**
   * Update monitoring configuration
   */
  async updateMonitoringConfig(config: Partial<MonitoringConfig>): Promise<void> {
    this.settings.monitoring = { ...this.settings.monitoring, ...config };
    await this.save();
  }

  /**
   * Get LLM settings
   */
  getLLMSettings(): AppSettings['llm'] {
    return { ...this.settings.llm };
  }

  /**
   * Update LLM settings
   */
  async updateLLMSettings(llmSettings: Partial<AppSettings['llm']>): Promise<void> {
    this.settings.llm = { ...this.settings.llm, ...llmSettings };
    await this.save();
  }

  /**
   * Get UI settings
   */
  getUISettings(): AppSettings['ui'] {
    return { ...this.settings.ui };
  }

  /**
   * Update UI settings
   */
  async updateUISettings(uiSettings: Partial<AppSettings['ui']>): Promise<void> {
    this.settings.ui = { ...this.settings.ui, ...uiSettings };
    await this.save();
  }

  /**
   * Get general settings
   */
  getGeneralSettings(): AppSettings['general'] {
    return { ...this.settings.general };
  }

  /**
   * Update general settings
   */
  async updateGeneralSettings(generalSettings: Partial<AppSettings['general']>): Promise<void> {
    this.settings.general = { ...this.settings.general, ...generalSettings };
    await this.save();
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    this.settings.monitoring.storage_path = path.join(app.getPath('userData'), 'activity_logs');
    await this.save();
  }

  /**
   * Get the settings file path
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Check if settings are loaded
   */
  isSettingsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Merge loaded settings with defaults to ensure all properties exist
   */
  private mergeWithDefaults(loadedSettings: Partial<AppSettings>): AppSettings {
    const merged: AppSettings = {
      monitoring: { ...DEFAULT_SETTINGS.monitoring, ...loadedSettings.monitoring },
      llm: { ...DEFAULT_SETTINGS.llm, ...loadedSettings.llm },
      ui: { ...DEFAULT_SETTINGS.ui, ...loadedSettings.ui },
      general: { ...DEFAULT_SETTINGS.general, ...loadedSettings.general },
    };

    // Ensure storage path is set
    if (!merged.monitoring.storage_path) {
      merged.monitoring.storage_path = path.join(app.getPath('userData'), 'activity_logs');
    }

    return merged;
  }

  /**
   * Validate and migrate settings if needed
   */
  private async validateAndMigrate(): Promise<void> {
    let needsSave = false;

    // Validate idle_threshold
    if (this.settings.monitoring.idle_threshold < 30) {
      this.settings.monitoring.idle_threshold = 30;
      needsSave = true;
    }
    if (this.settings.monitoring.idle_threshold > 3600) {
      this.settings.monitoring.idle_threshold = 3600;
      needsSave = true;
    }

    // Validate log_batch_size
    if (this.settings.monitoring.log_batch_size < 1) {
      this.settings.monitoring.log_batch_size = 1;
      needsSave = true;
    }
    if (this.settings.monitoring.log_batch_size > 10000) {
      this.settings.monitoring.log_batch_size = 10000;
      needsSave = true;
    }

    // Ensure storage path exists
    if (this.settings.monitoring.storage_path) {
      try {
        await fs.mkdir(this.settings.monitoring.storage_path, { recursive: true });
      } catch (error) {
        this.logger.warn('Could not create storage path, using default');
        this.settings.monitoring.storage_path = path.join(app.getPath('userData'), 'activity_logs');
        needsSave = true;
      }
    }

    if (needsSave) {
      await this.save();
    }
  }
} 