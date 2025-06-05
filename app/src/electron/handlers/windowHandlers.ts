import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';

export function setupWindowHandlers(
  getMainWindow: () => BrowserWindow | null,
  toggleDockVisibility: () => void,
  showDailyPlanNotification: () => void
) {
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

  // IPC handler for toggling dock visibility
  ipcMain.handle(IPC_CHANNELS.TOGGLE_DOCK, async () => {
    try {
      toggleDockVisibility();
      const mainWindow = getMainWindow();
      return { success: true, visible: mainWindow?.isVisible() || false };
    } catch (error) {
      console.error('[IPC] Toggle dock error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // IPC handler for opening chat window
  ipcMain.handle(IPC_CHANNELS.OPEN_CHAT_WINDOW, async (event, context = 'general') => {
    try {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        // Send message to main window to show chat dialog
        mainWindow.webContents.send('show-chat-dialog', context);
        // Show the main window if it's hidden
        mainWindow.show();
        mainWindow.focus();
      }
      return { success: true };
    } catch (error) {
      console.error('[IPC] Open chat window error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // IPC handler for showing daily plan notification manually
  ipcMain.handle(IPC_CHANNELS.SHOW_DAILY_PLAN_NOTIFICATION, async () => {
    try {
      showDailyPlanNotification();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Show daily plan notification error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 