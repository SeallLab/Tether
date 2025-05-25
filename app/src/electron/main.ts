import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { isDev } from "./util.js";
import { ActivityMonitoringService } from "./services/ActivityMonitoringService.js";
import { IPC_CHANNELS } from "../shared/constants.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize the activity monitoring service
let activityMonitoringService: ActivityMonitoringService;

app.on("ready", async () => {
  const mainWindow = new BrowserWindow({
    width: 60,
    height: 200,
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

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3000");
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
    idle_threshold: 30, // 30 seconds for testing (instead of default 300)
    idle_enabled: true,
    window_enabled: true,
    storage_path: path.join(__dirname, '..', '..', 'activity_logs'), // Store in app directory
    log_batch_size: 10
  });
  
  try {
    await activityMonitoringService.start();
    console.log('[Main] Activity monitoring started successfully');
  } catch (error) {
    console.error('[Main] Failed to start activity monitoring:', error);
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
