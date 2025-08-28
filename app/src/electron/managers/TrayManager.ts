import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isDev } from '../util.js';
import fs from 'fs';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TrayManager {
  private tray: Tray | null = null;
  private getMainWindow: () => BrowserWindow | null;
  private toggleDockVisibility: () => void;

  constructor(
    getMainWindow: () => BrowserWindow | null,
    toggleDockVisibility: () => void
  ) {
    this.getMainWindow = getMainWindow;
    this.toggleDockVisibility = toggleDockVisibility;
  }

  createTray(): void {
    // Get the icon path
    const iconPath = this.getTrayIconPath();
    
    if (!iconPath) {
      console.warn('[TrayManager] No tray icon found, skipping tray creation');
      return;
    }

    // Create tray icon
    const icon = nativeImage.createFromPath(iconPath);
    
    // Resize icon for tray (16x16 on Windows)
    const resizedIcon = icon.resize({ width: 16, height: 16 });
    
    this.tray = new Tray(resizedIcon);
    
    // Set tooltip
    this.tray.setToolTip('Tether - AI Activity Monitor');
    
    // Create context menu
    this.updateContextMenu();
    
    // Handle click events
    this.tray.on('click', () => {
      this.toggleDockVisibility();
    });

    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    console.log('[TrayManager] System tray created successfully');
  }

  private getTrayIconPath(): string | null {
    // Try different icon paths based on environment
    const possiblePaths: string[] = [];

    if (isDev()) {
      // In development mode
      possiblePaths.push(
        // From TrayManager.ts location: app/src/electron/managers/TrayManager.ts -> app/tether.png
        path.join(__dirname, '..', '..', '..', 'tether.png'),
        // Alternative: from app root
        path.join(process.cwd(), 'app', 'tether.png'),
        // Alternative: absolute path to app directory
        path.join(__dirname, '..', '..', '..', 'app', 'tether.png')
      );
    } else {
      // In packaged app
      possiblePaths.push(
        // From packaged resources
        path.join(process.resourcesPath, 'app', 'tether.png'),
        path.join(process.resourcesPath, 'tether.png'),
        // From app.asar
        path.join(process.resourcesPath, 'app.asar.unpacked', 'tether.png'),
        // Fallback to built location
        path.join(__dirname, '..', '..', 'tether.png')
      );
    }

    console.log('[TrayManager] DEBUG: __dirname =', __dirname);
    console.log('[TrayManager] DEBUG: process.cwd() =', process.cwd());
    console.log('[TrayManager] DEBUG: process.resourcesPath =', process.resourcesPath);
    console.log('[TrayManager] DEBUG: isDev() =', isDev());

    for (const iconPath of possiblePaths) {
      try {
        console.log('[TrayManager] DEBUG: Checking path:', iconPath);
        if (fs.existsSync(iconPath)) {
          console.log('[TrayManager] Found tray icon at:', iconPath);
          return iconPath;
        }
      } catch (error) {
        console.log('[TrayManager] DEBUG: Error checking path:', iconPath, error);
      }
    }

    console.warn('[TrayManager] No tray icon found in any of the expected paths:', possiblePaths);
    return null;
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    const mainWindow = this.getMainWindow();
    const isVisible = mainWindow?.isVisible() || false;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Tether AI Monitor',
        enabled: false
      },
      { type: 'separator' },
      {
        label: isVisible ? 'Hide Dock' : 'Show Dock',
        click: () => {
          this.toggleDockVisibility();
          // Update menu after toggling
          setTimeout(() => this.updateContextMenu(), 100);
        }
      },
      {
        label: 'Show Main Window',
        click: () => this.showMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          const mainWindow = this.getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('open-settings');
            this.showMainWindow();
          }
        }
      },
      {
        label: 'Chat Assistant',
        click: () => {
          const mainWindow = this.getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('show-chat-dialog', 'tray');
            this.showMainWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Tether',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private showMainWindow(): void {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      // Force always on top on Windows
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      this.updateContextMenu();
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('[TrayManager] System tray destroyed');
    }
  }

  updateMenu(): void {
    this.updateContextMenu();
  }
}
