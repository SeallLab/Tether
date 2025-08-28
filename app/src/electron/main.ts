import { app } from "electron";
import { AppManager, WindowManager, NotificationManager, TrayManager } from './managers/index.js';
import { setupActivityHandlers, setupLLMHandlers, setupWindowHandlers, setupChatHandlers, setupSettingsHandlers, setupNotificationHandlers, setupPythonServerHandlers, setupGamificationHandlers } from './handlers/index.js';

// Initialize managers
const appManager = new AppManager();
const windowManager = new WindowManager(appManager.getPreloadPath());
const notificationManager = new NotificationManager(() => windowManager.getMainWindow());
const trayManager = new TrayManager(
  () => windowManager.getMainWindow(),
  () => windowManager.toggleDockVisibility()
);

app.on("ready", async () => {
  // Set App User Model ID for Windows (for proper taskbar grouping)
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.aarsh.tether');
  }
  
  // Initialize app manager (loads settings)
  await appManager.initialize();
  
  // Setup IPC handlers BEFORE creating the window to avoid timing issues
  const activityService = appManager.getActivityMonitoringService();
  const chatService = activityService.getChatService();
  const settingsService = appManager.getSettingsService();
  const pythonServerService = appManager.getPythonServerService();
  
  setupActivityHandlers(activityService);
  setupLLMHandlers(activityService);
  setupChatHandlers(chatService);
  setupSettingsHandlers(settingsService);
  setupNotificationHandlers(activityService.getNotificationService());
  setupPythonServerHandlers(pythonServerService);
  setupGamificationHandlers(activityService.getGamificationService(), activityService.getNotificationService());
  setupWindowHandlers(
    () => windowManager.getMainWindow(),
    () => windowManager.toggleDockVisibility(),
    () => notificationManager.showDailyPlanNotification()
  );

  // Create main window AFTER handlers are set up
  const mainWindow = windowManager.createMainWindow();
  
  // Create system tray for easy access
  if (process.platform === 'win32') {
    trayManager.createTray();
  }
  
  // Start activity monitoring
  await appManager.startActivityMonitoring();
  // Setup global shortcuts
  appManager.setupGlobalShortcuts(() => {
    windowManager.toggleDockVisibility();
  });

  // Schedule startup notification (30 seconds after app starts)
  notificationManager.scheduleStartupNotification(30000);
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  // On macOS, apps typically stay running even when all windows are closed
  // unless the user explicitly quits with Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before-quit event (when user explicitly quits with Cmd+Q or Quit menu)
app.on('before-quit', async (event) => {
  
  // Prevent immediate quit to allow cleanup
  event.preventDefault();
  
  try {
    // Shutdown Python server
    await appManager.getPythonServerService().shutdown();
    
    // Clear any timers or notifications
    notificationManager.clearStartupTimer();
    
    // Destroy system tray
    if (process.platform === 'win32') {
      trayManager.destroy();
    }
    
    // Unregister global shortcuts
    const { globalShortcut } = await import('electron');
    globalShortcut.unregisterAll();
    
    // Now actually quit the app
    app.exit(0);
    
  } catch (error) {
    // Force quit even if cleanup fails
    app.exit(1);
  }
});

// Setup app event handlers (for activate event on macOS)
appManager.setupAppEventHandlers(
  () => windowManager.showMainWindow(),
  () => notificationManager.clearStartupTimer()
);
