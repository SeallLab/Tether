import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import { isDev } from "./util.js";
import { ActivityMonitoringService } from "./services/ActivityMonitoringService.js";
import { IPC_CHANNELS } from "../shared/constants.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
// The .env file is in the app directory, so we go up 2 levels: dist-electron/electron -> dist-electron -> app
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Initialize the activity monitoring service
let activityMonitoringService: ActivityMonitoringService;
let mainWindow: BrowserWindow;

app.on("ready", async () => {
  mainWindow = new BrowserWindow({
    width: 55,
    height: 115,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Handle window.open requests
  mainWindow.webContents.setWindowOpenHandler(({ url, features }) => {
    console.log('[Main] Window open request:', { url, features });
    
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
          preload: path.join(__dirname, 'preload.js')
        }
      }
    };
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3000");
    // BRING BACK IF NEEDED: Open developer tools in development mode
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }

  // Prevent the window from being closed
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Initialize and start activity monitoring service automatically
  console.log('[Main] Initializing activity monitoring service...');
  activityMonitoringService = new ActivityMonitoringService({
    idle_threshold: 1000, // 10 seconds for testing (instead of default 300)
    idle_enabled: true,
    window_enabled: true,
    storage_path: path.join(__dirname, '..', '..', 'activity_logs'), // Store in app directory
    log_batch_size: 100
  });
  
  try {
    await activityMonitoringService.start();
    console.log('[Main] Activity monitoring started successfully');
    
    // Initialize LLM service
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      console.log('[Main] Found Gemini API key in environment, initializing with Gemini');
      activityMonitoringService.initializeLLM(geminiApiKey);
    } else {
      console.log('[Main] No Gemini API key found, using mock provider');
      activityMonitoringService.initializeLLM();
    }
    console.log('[Main] LLM service initialized');
  } catch (error) {
    console.error('[Main] Failed to start activity monitoring:', error);
  }
});

// Handle child window option updates
ipcMain.on('update-child-window-options', (event, { windowId, options }) => {
  console.log('[Main] Updating child window options:', { windowId, options });
  // Find the window and update its options
  const allWindows = BrowserWindow.getAllWindows();
  const targetWindow = allWindows.find(win => win.webContents.id.toString() === windowId);
  
  if (targetWindow) {
    // Update window properties that can be changed after creation
    if (options.alwaysOnTop !== undefined) {
      targetWindow.setAlwaysOnTop(options.alwaysOnTop);
    }
    if (options.title) {
      targetWindow.setTitle(options.title);
    }
    // Add more updatable properties as needed
  }
});

// Set up IPC handlers for activity monitoring
ipcMain.handle(IPC_CHANNELS.START_ACTIVITY_MONITORING, async () => {
  try {
    await activityMonitoringService.start();
    return { success: true, data: activityMonitoringService.getStatus() };
  } catch (error) {
    console.error('[IPC] Start monitoring error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle(IPC_CHANNELS.STOP_ACTIVITY_MONITORING, async () => {
  try {
    await activityMonitoringService.stop();
    return { success: true, data: activityMonitoringService.getStatus() };
  } catch (error) {
    console.error('[IPC] Stop monitoring error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle(IPC_CHANNELS.GET_ACTIVITY_STATUS, async () => {
  try {
    const status = activityMonitoringService.getStatus();
    return { success: true, data: status };
  } catch (error) {
    console.error('[IPC] Get status error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle(IPC_CHANNELS.GET_RECENT_ACTIVITY, async (event, minutes = 60) => {
  try {
    const activity = await activityMonitoringService.getRecentActivity(minutes);
    return { success: true, data: activity };
  } catch (error) {
    console.error('[IPC] Get recent activity error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle(IPC_CHANNELS.UPDATE_MONITORING_CONFIG, async (event, config) => {
  try {
    activityMonitoringService.updateConfig(config);
    return { success: true, data: activityMonitoringService.getStatus() };
  } catch (error) {
    console.error('[IPC] Update config error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// LLM Service IPC handlers
ipcMain.handle(IPC_CHANNELS.SET_LLM_API_KEY, async (event, apiKey) => {
  try {
    activityMonitoringService.initializeLLM(apiKey);
    return { success: true, data: activityMonitoringService.getLLMStatus() };
  } catch (error) {
    console.error('[IPC] Set LLM API key error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle(IPC_CHANNELS.GET_LLM_STATUS, async () => {
  try {
    const status = activityMonitoringService.getLLMStatus();
    return { success: true, data: status };
  } catch (error) {
    console.error('[IPC] Get LLM status error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
