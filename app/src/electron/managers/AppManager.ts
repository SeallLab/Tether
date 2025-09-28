import { app, globalShortcut } from 'electron';
import { injectable, inject } from 'tsyringe';
import { SettingsService } from '../services/SettingsService.js';
import { PythonServerService } from '../services/PythonServerService.js';
import { Logger } from '../utils/Logger.js';

@injectable()
export class AppManager {
  private logger: Logger;
  private settingsService: SettingsService;
  private pythonServerService: PythonServerService;

  constructor(
    @inject(SettingsService) settingsService: SettingsService,
    @inject(PythonServerService) pythonServerService: PythonServerService
  ) {
    this.logger = new Logger({ name: 'AppManager' });
    this.settingsService = settingsService;
    this.pythonServerService = pythonServerService;
    this.setupStartupBehavior();
  }

  async initialize(): Promise<void> {
    // Initialize Python server service
    try {
      this.logger.info('Starting Python server service...');
      await this.pythonServerService.initialize();
      this.logger.info('Python server service started successfully');
    } catch (error) {
      this.logger.error('Failed to start Python server service:', error as Error);
    }
    
    this.logger.info('Initialization complete');
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


  setupGlobalShortcuts(toggleDockCallback: () => void): void {
    // Register global keyboard shortcut for toggling dock
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+D', () => {
      this.logger.info('Dock toggle shortcut pressed');
      toggleDockCallback();
    });

    if (!shortcutRegistered) {
      this.logger.error('Failed to register global shortcut for dock toggle');
    } else {
      this.logger.info('Global shortcut registered: CommandOrControl+Shift+D');
    }
  }

  setupAppEventHandlers(showMainWindow: () => void): void {
    app.on('activate', () => {
      this.logger.info('App activated, showing main window');
      showMainWindow();
    });
  }

} 