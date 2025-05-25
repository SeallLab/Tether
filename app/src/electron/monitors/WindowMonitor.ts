import { BaseMonitor } from './BaseMonitor.js';
import { ActivityType, WindowData } from '../../shared/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WindowMonitor extends BaseMonitor {
  private currentWindow: WindowData | null = null;
  private pollInterval: number;

  constructor(logger: any, pollInterval: number = 2000) { // Poll every 2 seconds
    super(logger);
    this.pollInterval = pollInterval;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[WindowMonitor] Starting window monitoring...');
    this.isRunning = true;

    // Get initial window
    await this.checkActiveWindow();

    // Set up polling
    this.setInterval(async () => {
      await this.checkActiveWindow();
    }, this.pollInterval);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[WindowMonitor] Stopping window monitoring...');
    this.isRunning = false;
    this.clearInterval();
  }

  public getName(): string {
    return 'WindowMonitor';
  }

  private async checkActiveWindow(): Promise<void> {
    try {
      const windowData = await this.getActiveWindowInfo();
      
      if (windowData && this.hasWindowChanged(windowData)) {
        this.currentWindow = windowData;
        this.logger.log(ActivityType.WINDOW_CHANGE, windowData);
      }
    } catch (error) {
      console.error('[WindowMonitor] Failed to get window info:', error);
    }
  }

  private hasWindowChanged(newWindow: WindowData): boolean {
    if (!this.currentWindow) return true;
    
    return (
      this.currentWindow.application_name !== newWindow.application_name ||
      this.currentWindow.window_title !== newWindow.window_title ||
      this.currentWindow.process_name !== newWindow.process_name
    );
  }

  private async getActiveWindowInfo(): Promise<WindowData | null> {
    try {
      if (process.platform === 'darwin') {
        return await this.getActiveWindowMacOS();
      } else if (process.platform === 'win32') {
        return await this.getActiveWindowWindows();
      } else if (process.platform === 'linux') {
        return await this.getActiveWindowLinux();
      }
    } catch (error) {
      console.error('[WindowMonitor] Platform-specific window detection failed:', error);
    }
    
    return null;
  }

  private async getActiveWindowMacOS(): Promise<WindowData | null> {
    try {
      // Get active application
      const { stdout: appScript } = await execAsync(`
        osascript -e '
          tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set windowTitle to ""
            try
              set windowTitle to name of front window of frontApp
            end try
            return appName & "|" & windowTitle
          end tell
        '
      `);

      const [appName, windowTitle] = appScript.trim().split('|');

      // Get process info
      const { stdout: processScript } = await execAsync(`
        osascript -e '
          tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set processName to unix id of frontApp
            return processName
          end tell
        '
      `);

      const processId = processScript.trim();

      return {
        application_name: appName || 'Unknown',
        window_title: windowTitle || 'No Window',
        process_name: processId || 'unknown',
        window_bounds: undefined // Could be enhanced to get actual bounds
      };
    } catch (error) {
      console.error('[WindowMonitor] macOS window detection failed:', error);
      return null;
    }
  }

  private async getActiveWindowWindows(): Promise<WindowData | null> {
    try {
      // For Windows, we'd need a different approach, potentially using PowerShell
      const { stdout } = await execAsync(`
        powershell "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::ComputerName"
      `);
      
      // This is a simplified version - you'd want to implement proper Windows API calls
      return {
        application_name: 'Windows App',
        window_title: 'Windows Window',
        process_name: 'unknown',
        window_bounds: undefined
      };
    } catch (error) {
      console.error('[WindowMonitor] Windows window detection failed:', error);
      return null;
    }
  }

  private async getActiveWindowLinux(): Promise<WindowData | null> {
    try {
      // For Linux, using xdotool or wmctrl
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowname');
      const windowTitle = stdout.trim();

      const { stdout: appStdout } = await execAsync('xdotool getwindowfocus getwindowpid');
      const pid = appStdout.trim();

      const { stdout: processStdout } = await execAsync(`ps -p ${pid} -o comm=`);
      const processName = processStdout.trim();

      return {
        application_name: processName || 'Unknown',
        window_title: windowTitle || 'No Window',
        process_name: processName || 'unknown',
        window_bounds: undefined
      };
    } catch (error) {
      console.error('[WindowMonitor] Linux window detection failed:', error);
      return null;
    }
  }

  public getCurrentWindow(): WindowData | null {
    return this.currentWindow;
  }
} 