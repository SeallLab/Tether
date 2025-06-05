const { contextBridge, ipcRenderer } = require('electron');

// Inline constants to avoid ES6 import issues in preload script
const IPC_CHANNELS = {
  OPEN_SETTINGS_WINDOW: 'open-settings-window',
  
  // Activity Monitoring
  START_ACTIVITY_MONITORING: 'start-activity-monitoring',
  STOP_ACTIVITY_MONITORING: 'stop-activity-monitoring',
  GET_ACTIVITY_STATUS: 'get-activity-status',
  GET_RECENT_ACTIVITY: 'get-recent-activity',
  UPDATE_MONITORING_CONFIG: 'update-monitoring-config',
  
  // LLM Focus Notifications
  FOCUS_NOTIFICATION: 'focus-notification',
  SET_LLM_API_KEY: 'set-llm-api-key',
  GET_LLM_STATUS: 'get-llm-status',
  
  // Dock Controls
  TOGGLE_DOCK: 'toggle-dock',
  
  // Chat Window
  OPEN_CHAT_WINDOW: 'open-chat-window',
  SHOW_DAILY_PLAN_NOTIFICATION: 'show-daily-plan-notification'
} as const;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event: any, ...args: any[]) => listener(...args));
    },
    once: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (event: any, ...args: any[]) => listener(...args));
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  
  // Activity monitoring API
  activityMonitoring: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.START_ACTIVITY_MONITORING),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_ACTIVITY_MONITORING),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVITY_STATUS),
    getRecentActivity: (minutes?: number) => ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_ACTIVITY, minutes),
    updateConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_MONITORING_CONFIG, config)
  },

  // LLM service API
  llm: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_LLM_API_KEY, apiKey),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LLM_STATUS),
    onFocusNotification: (callback: (response: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.FOCUS_NOTIFICATION, (event: any, data: any) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FOCUS_NOTIFICATION);
    }
  },

  // Dock control API
  dock: {
    toggle: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_DOCK)
  },

  // Chat window API
  chat: {
    open: (context?: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_CHAT_WINDOW, context),
    showDailyPlanNotification: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_DAILY_PLAN_NOTIFICATION)
  }
});