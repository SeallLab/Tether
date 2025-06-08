import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import type { SettingsService } from '../services/SettingsService.js';

export function setupSettingsHandlers(settingsService: SettingsService) {
  // Get all settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    try {
      const settings = settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      console.error('[IPC] Get settings error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Update settings (generic handler for any settings section)
  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (event, { section, settings }) => {
    try {
      switch (section) {
        case 'monitoring':
          await settingsService.updateMonitoringConfig(settings);
          break;
        case 'llm':
          await settingsService.updateLLMSettings(settings);
          break;
        case 'ui':
          await settingsService.updateUISettings(settings);
          break;
        case 'general':
          await settingsService.updateGeneralSettings(settings);
          break;
        default:
          throw new Error(`Unknown settings section: ${section}`);
      }
      
      const updatedSettings = settingsService.getSettings();
      return { success: true, data: updatedSettings };
    } catch (error) {
      console.error('[IPC] Update settings error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Reset settings to defaults
  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async () => {
    try {
      await settingsService.resetToDefaults();
      const settings = settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      console.error('[IPC] Reset settings error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get settings file path
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS_PATH, async () => {
    try {
      const path = settingsService.getSettingsPath();
      return { success: true, data: path };
    } catch (error) {
      console.error('[IPC] Get settings path error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
} 