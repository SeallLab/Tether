import { app, globalShortcut } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ActivityMonitoringService } from '../services/ActivityMonitoringService.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AppManager {
  private activityMonitoringService: ActivityMonitoringService;

  constructor() {
    this.loadEnvironmentVariables();
    this.setupStartupBehavior();
    this.activityMonitoringService = this.initializeActivityMonitoring();
  }

  private loadEnvironmentVariables(): void {
    // Load environment variables from .env file
    // The .env file is in the app directory, so we go up 3 levels: dist-electron/electron/managers -> dist-electron/electron -> dist-electron -> app
    dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
  }

  private setupStartupBehavior(): void {
    // Enable startup on system boot
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true, // Start hidden on startup
      name: 'Tether',
      path: process.execPath
    });
  }

  private initializeActivityMonitoring(): ActivityMonitoringService {
    return new ActivityMonitoringService({
      idle_threshold: 10, // 10 seconds for testing (instead of default 300)
      idle_enabled: true,
      window_enabled: true,
      storage_path: path.join(__dirname, '..', '..', '..', 'activity_logs'), // Store in app directory
      log_batch_size: 10
    });
  }

  async startActivityMonitoring(): Promise<void> {
    try {
      await this.activityMonitoringService.start();
      console.log('[AppManager] Activity monitoring started successfully');
      
      // Initialize LLM service
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        console.log('[AppManager] Found Gemini API key in environment, initializing with Gemini');
        this.activityMonitoringService.initializeLLM(geminiApiKey);
      } else {
        console.log('[AppManager] No Gemini API key found, using mock provider');
        this.activityMonitoringService.initializeLLM();
      }
      console.log('[AppManager] LLM service initialized');
    } catch (error) {
      console.error('[AppManager] Failed to start activity monitoring:', error);
    }
  }

  setupGlobalShortcuts(toggleDockCallback: () => void): void {
    // Register global keyboard shortcut for toggling dock
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+D', () => {
      console.log('[AppManager] Dock toggle shortcut pressed');
      toggleDockCallback();
    });

    if (!shortcutRegistered) {
      console.error('[AppManager] Failed to register global shortcut for dock toggle');
    } else {
      console.log('[AppManager] Global shortcut registered: CommandOrControl+Shift+D');
    }
  }

  setupAppEventHandlers(showMainWindow: () => void, cleanup: () => void): void {
    // Handle app activation (macOS)
    app.on('activate', () => {
      showMainWindow();
    });

    // Cleanup when app quits
    app.on('will-quit', () => {
      console.log('[AppManager] Unregistering global shortcuts');
      globalShortcut.unregisterAll();
      cleanup();
    });
  }

  getActivityMonitoringService(): ActivityMonitoringService {
    return this.activityMonitoringService;
  }

  getPreloadPath(): string {
    return path.join(__dirname, '..', 'preload.js');
  }
} 