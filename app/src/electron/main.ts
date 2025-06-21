import { app } from "electron";
import { AppManager, WindowManager, NotificationManager } from './managers/index.js';
import { setupActivityHandlers, setupLLMHandlers, setupWindowHandlers, setupChatHandlers, setupSettingsHandlers, setupNotificationHandlers, setupPythonServerHandlers } from './handlers/index.js';

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
  setupWindowHandlers(
    () => windowManager.getMainWindow(),
    () => windowManager.toggleDockVisibility(),
    () => notificationManager.showDailyPlanNotification()
  );

  // Schedule startup notification (30 seconds after app starts)
  notificationManager.scheduleStartupNotification(30000);

  console.log('[Main] App initialization complete');
});

// Setup app event handlers
appManager.setupAppEventHandlers(
  () => windowManager.showMainWindow(),
  () => notificationManager.clearStartupTimer()
);
