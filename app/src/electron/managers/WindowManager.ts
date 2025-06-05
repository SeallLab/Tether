import { BrowserWindow, app } from 'electron';
import path from 'path';
import { isDev } from '../util.js';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private preloadPath: string;

  constructor(preloadPath: string) {
    this.preloadPath = preloadPath;
  }

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 55,
      height: 115,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: this.preloadPath
      }
    });

    this.setupMainWindowHandlers();
    this.loadMainWindow();

    return this.mainWindow;
  }

  private setupMainWindowHandlers(): void {
    if (!this.mainWindow) return;

    // Handle window.open requests
    this.mainWindow.webContents.setWindowOpenHandler(({ url, features }) => {
      console.log('[WindowManager] Window open request:', { url, features });
      
      // Parse the features string to extract window options
      const options: any = {};
      if (features) {
        features.split(',').forEach(feature => {
          const [key, value] = feature.split('=');
          if (key && value) {
            // Convert string values to appropriate types
            if (value === 'true') options[key] = true;
            else if (value === 'false') options[key] = false;
            else if (!isNaN(Number(value))) options[key] = Number(value);
            else options[key] = value;
          }
        });
      }

      // Create BrowserWindow with the parsed options
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: options.width || 800,
          height: options.height || 600,
          x: options.x,
          y: options.y,
          alwaysOnTop: options.alwaysOnTop || false,
          frame: options.frame !== false, // Default to true unless explicitly false
          transparent: options.transparent || false,
          resizable: options.resizable !== false, // Default to true unless explicitly false
          center: options.center !== false, // Default to true unless explicitly false
          title: options.title || 'Tether Settings',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: this.preloadPath
          }
        }
      };
    });

    // Prevent the window from being closed
    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.mainWindow?.hide();
    });
  }

  private loadMainWindow(): void {
    if (!this.mainWindow) return;

    if (isDev()) {
      this.mainWindow.loadURL("http://localhost:3000");
      // Enable developer tools in development mode to see console output
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
    }

    // Check if app was started at login and hide initially
    if (app.getLoginItemSettings().wasOpenedAtLogin) {
      console.log('[WindowManager] App was opened at login, starting hidden');
      this.mainWindow.hide();
    }
  }

  toggleDockVisibility(): void {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isVisible()) {
      console.log('[WindowManager] Hiding dock');
      this.mainWindow.hide();
    } else {
      console.log('[WindowManager] Showing dock');
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  showMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
    }
  }
} 