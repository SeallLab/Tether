import { app, globalShortcut } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ActivityMonitoringService } from '../services/ActivityMonitoringService.js';
import { SettingsService } from '../services/SettingsService.js';
import { PythonServerService } from '../services/PythonServerService.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AppManager {
  private activityMonitoringService!: ActivityMonitoringService;
  private settingsService: SettingsService;
  private pythonServerService: PythonServerService;

  constructor() {
    this.loadEnvironmentVariables();
    this.settingsService = new SettingsService();
    this.pythonServerService = new PythonServerService();
    this.setupStartupBehavior();
  }

  async initialize(): Promise<void> {
    // Load settings first
    await this.settingsService.load();
    
    // Initialize Python server service
    try {
      console.log('[AppManager] Starting Python server service...');
      await this.pythonServerService.initialize();
      console.log('[AppManager] Python server service started successfully');
    } catch (error) {
      console.error('[AppManager] Failed to start Python server service:', error);
      // Continue without Python server for now
    }
    
    // Initialize activity monitoring with loaded settings
    this.activityMonitoringService = this.initializeActivityMonitoring();
    
    console.log('[AppManager] Initialization complete');
  }

  private loadEnvironmentVariables(): void {
    // Load environment variables from .env file
    // The .env file is in the app directory, so we go up 3 levels: dist-electron/electron/managers -> dist-electron/electron -> dist-electron -> app
    dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
  }

  private setupStartupBehavior(): void {
    // We'll update this to use settings later
    const generalSettings = this.settingsService?.getGeneralSettings();
    const startAtLogin = generalSettings?.startAtLogin ?? true;
    
    // Enable startup on system boot
    app.setLoginItemSettings({
      openAtLogin: startAtLogin,
      openAsHidden: false,
      name: 'Tether',
      path: process.execPath
    });
  }

  private initializeActivityMonitoring(): ActivityMonitoringService {
    return new ActivityMonitoringService(this.settingsService);
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
    app.on('will-quit', async () => {
      console.log('[AppManager] Unregistering global shortcuts');
      globalShortcut.unregisterAll();
      
      // Shutdown Python server
      try {
        await this.pythonServerService.shutdown();
      } catch (error) {
        console.error('[AppManager] Error shutting down Python server:', error);
      }
      
      cleanup();
    });
  }

  getActivityMonitoringService(): ActivityMonitoringService {
    return this.activityMonitoringService;
  }

  getSettingsService(): SettingsService {
    return this.settingsService;
  }

  getPreloadPath(): string {
    return path.join(__dirname, '..', 'preload.js');
  }

  getPythonServerService(): PythonServerService {
    return this.pythonServerService;
  }
} 