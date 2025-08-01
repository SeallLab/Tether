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
    
    // Pass Google API key explicitly to Python server service
    const googleApiKey = process.env.GOOGLE_API_KEY || '';
          console.log('[AppManager] DEBUG: Google API Key loaded:', googleApiKey ? '***SET***' : '***NOT SET***');
      console.log('[AppManager] DEBUG: All env vars:', {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***',
        ENV: process.env.ENV
      });
    
    this.pythonServerService = new PythonServerService({
      googleApiKey: googleApiKey
    });
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
    
    // Inject Python server service into chat service after both are initialized
    const chatService = this.activityMonitoringService.getChatService();
    chatService.setPythonServerService(this.pythonServerService);
    
    console.log('[AppManager] Initialization complete');
  }

  private loadEnvironmentVariables(): void {
    console.log('[AppManager] DEBUG: Loading environment variables...');
    console.log('[AppManager] DEBUG: isPackaged:', app.isPackaged);
    console.log('[AppManager] DEBUG: __dirname:', __dirname);
    
    // Load environment variables from .env file
    if (app.isPackaged) {
      // In packaged app, try to load from multiple possible locations
      const possiblePaths = [
        path.join(process.resourcesPath, '.env'),
        path.join(process.resourcesPath, 'app', '.env'),
        path.join(__dirname, '..', '..', '..', '.env'),
      ];
      
      console.log('[AppManager] DEBUG: Trying to load .env from paths:', possiblePaths);
      
      let envLoaded = false;
      for (const envPath of possiblePaths) {
        try {
          const result = dotenv.config({ path: envPath });
          if (!result.error) {
            console.log('[AppManager] DEBUG: Successfully loaded .env from:', envPath);
            envLoaded = true;
            break;
          }
        } catch (error) {
          console.log('[AppManager] DEBUG: Could not load .env from:', envPath, error);
        }
      }
      
      if (!envLoaded) {
        console.warn('[AppManager] WARNING: No .env file found in packaged app. Using system environment variables only.');
      }
    } else {
      // In development, load from app directory
      const envPath = path.join(__dirname, '..', '..', '..', '.env');
      console.log('[AppManager] DEBUG: Loading .env from development path:', envPath);
      const result = dotenv.config({ path: envPath });
      if (result.error) {
        console.warn('[AppManager] WARNING: Could not load .env file:', result.error);
      } else {
        console.log('[AppManager] DEBUG: Successfully loaded .env file');
      }
    }
    
    // Log environment variables after loading
    console.log('[AppManager] DEBUG: Environment variables after loading:');
    console.log('  GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***');
    console.log('  ENV:', process.env.ENV);
    console.log('  NODE_ENV:', process.env.NODE_ENV);
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
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (googleApiKey) {
        console.log('[AppManager] Found Google API key in environment, initializing with Gemini');
        this.activityMonitoringService.initializeLLM(googleApiKey);
      } else {
        console.log('[AppManager] No Google API key found, using mock provider');
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
    // Handle app activation (macOS) - when user clicks on dock icon
    app.on('activate', () => {
      console.log('[AppManager] App activated, showing main window');
      showMainWindow();
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