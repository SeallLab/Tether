import { app } from "electron";
import { AppManager, WindowManager, NotificationManager } from './managers/index.js';
import { setupActivityHandlers, setupLLMHandlers, setupWindowHandlers, setupChatHandlers, setupSettingsHandlers, setupNotificationHandlers, setupPythonServerHandlers, setupGamificationHandlers } from './handlers/index.js';

// Initialize managers
const appManager = new AppManager();
const windowManager = new WindowManager(appManager.getPreloadPath());
const notificationManager = new NotificationManager(() => windowManager.getMainWindow());

app.on("ready", async () => {
  console.log('[Main] App ready, initializing...');

  // Initialize app manager (loads settings)
  await appManager.initialize();

  // Create main window
  const mainWindow = windowManager.createMainWindow();
  console.log('[Main] Main window created');

  // Start activity monitoring
  await appManager.startActivityMonitoring();

  // Setup global shortcuts
  appManager.setupGlobalShortcuts(() => {
    windowManager.toggleDockVisibility();
  });

  // Setup IPC handlers
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

  // Schedule startup notification (30 seconds after app starts)
  notificationManager.scheduleStartupNotification(30000);

  console.log('[Main] App initialization complete');
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  console.log('[Main] All windows closed');
  // On macOS, apps typically stay running even when all windows are closed
  // unless the user explicitly quits with Cmd+Q
  if (process.platform !== 'darwin') {
    console.log('[Main] Non-macOS platform, quitting app');
    app.quit();
  } else {
    console.log('[Main] macOS platform, keeping app running in dock');
  }
});

// Handle before-quit event (when user explicitly quits with Cmd+Q or Quit menu)
app.on('before-quit', async (event) => {
  console.log('[Main] App is about to quit, performing cleanup...');
  
  // Prevent immediate quit to allow cleanup
  event.preventDefault();
  
  try {
    // Shutdown Python server
    console.log('[Main] Shutting down Python server...');
    await appManager.getPythonServerService().shutdown();
    console.log('[Main] Python server shutdown complete');
    
    // Clear any timers or notifications
    notificationManager.clearStartupTimer();
    
    // Unregister global shortcuts
    console.log('[Main] Unregistering global shortcuts...');
    const { globalShortcut } = await import('electron');
    globalShortcut.unregisterAll();
    
    console.log('[Main] Cleanup complete, quitting app');
    
    // Now actually quit the app
    app.exit(0);
    
  } catch (error) {
    console.error('[Main] Error during cleanup:', error);
    // Force quit even if cleanup fails
    app.exit(1);
  }
});

// Setup app event handlers (for activate event on macOS)
appManager.setupAppEventHandlers(
  () => windowManager.showMainWindow(),
  () => notificationManager.clearStartupTimer()
);
