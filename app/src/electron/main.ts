import "reflect-metadata";
import { app } from "electron";
import { configureContainer, container } from './container.js';
import { AppManager, WindowManager, NotificationManager, TrayManager } from './managers/index.js';
import { setupActivityHandlers, setupLLMHandlers, setupWindowHandlers, setupChatHandlers, setupSettingsHandlers, setupNotificationHandlers, setupPythonServerHandlers, setupGamificationHandlers } from './handlers/index.js';
import { ChatService } from "./services/ChatService.js";
import { NotificationService } from "./services/NotificationService.js";
import { GamificationService } from "./services/GamificationService.js";
import { ActivityMonitoringService } from "./services/ActivityMonitoringService.js";
import { PythonServerService } from "./services/PythonServerService.js";
import { SettingsService } from "./services/SettingsService.js";

// Configure dependency injection container
configureContainer();

// Resolve all managers and services from container
const appManager = container.resolve(AppManager);
const chatService = container.resolve(ChatService);
const windowManager = container.resolve(WindowManager);
const notificationManager = container.resolve(NotificationManager);
const trayManager = container.resolve(TrayManager);
const notificationService = container.resolve(NotificationService);
const gamificationService = container.resolve(GamificationService);
const activityService = container.resolve(ActivityMonitoringService);
const pythonServerService = container.resolve(PythonServerService);
const settingsService = container.resolve(SettingsService);


app.on("ready", async () => {
  // Set App User Model ID for Windows (for proper taskbar grouping and notification display)
  if (process.platform === 'win32') {
    app.setAppUserModelId('Tether');
  }
  
  // Initialize app manager (loads settings)
  await appManager.initialize();
  
  // Setup IPC handlers BEFORE creating the window to avoid timing issues
  setupActivityHandlers(activityService);
  setupLLMHandlers(activityService);
  setupChatHandlers(chatService);
  setupSettingsHandlers(settingsService);
  setupNotificationHandlers(notificationService);
  setupPythonServerHandlers(pythonServerService);
  setupGamificationHandlers(gamificationService, notificationService);
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
  await activityService.start();
  
  // Initialize LLM service with API key
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (googleApiKey) {
    console.log('[Main] Found Google API key in environment, initializing with Gemini');
    activityService.initializeLLM(googleApiKey);
  } else {
    console.log('[Main] No Google API key found, using mock provider');
    activityService.initializeLLM();
  }
  console.log('[Main] LLM service initialized');
  
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
    await pythonServerService.shutdown();
    
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
appManager.setupAppEventHandlers(() => windowManager.showMainWindow());
