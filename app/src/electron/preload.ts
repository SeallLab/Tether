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
  
  // Settings Management
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  RESET_SETTINGS: 'reset-settings',
  GET_SETTINGS_PATH: 'get-settings-path',
  
  // LLM Focus Notifications
  FOCUS_NOTIFICATION: 'focus-notification',
  SET_LLM_API_KEY: 'set-llm-api-key',
  GET_LLM_STATUS: 'get-llm-status',
  
  // Chat functionality
  SEND_CHAT_MESSAGE: 'send-chat-message',
  GET_CHAT_SESSIONS: 'get-chat-sessions',
  GET_CHAT_HISTORY: 'get-chat-history',
  CREATE_CHAT_SESSION: 'create-chat-session',
  DELETE_CHAT_SESSION: 'delete-chat-session',
  
  // Dock Controls
  TOGGLE_DOCK: 'toggle-dock',
  
  // Chat Window
  OPEN_CHAT_WINDOW: 'open-chat-window',
  SHOW_DAILY_PLAN_NOTIFICATION: 'show-daily-plan-notification',

    // Notifications
  GET_NOTIFICATION_STATS: 'get-notification-stats',
  GET_RECENT_NOTIFICATIONS: 'get-recent-notifications',

  // Python Server
  PYTHON_SERVER_GET_STATUS: 'python-server:get-status',
  PYTHON_SERVER_GET_URL: 'python-server:get-url',
  PYTHON_SERVER_HEALTH_CHECK: 'python-server:health-check',
  PYTHON_SERVER_API_REQUEST: 'python-server:api-request',
  
  // Gamification
  GET_GAMIFICATION_DATA: 'get-gamification-data',
  UPDATE_GAMIFICATION_DATA: 'update-gamification-data',
  AWARD_POINTS: 'award-points',
  UNLOCK_THEME: 'unlock-theme',
  SET_DOCK_THEME: 'set-dock-theme',
  COMPLETE_QUEST: 'complete-quest',
  EARN_BADGE: 'earn-badge',
  CHECK_FIRST_TIME_SETTINGS: 'check-first-time-settings',
  POINT_EARNED_NOTIFICATION: 'point-earned-notification',
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

  // Settings API
  settings: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
    update: (section: string, settings: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, { section, settings }),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_SETTINGS),
    getPath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS_PATH)
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

  // Chat API
  chat: {
    sendMessage: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.SEND_CHAT_MESSAGE, request),
    getSessions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CHAT_SESSIONS),
    getHistory: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CHAT_HISTORY, sessionId),
    createSession: (context?: string) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_CHAT_SESSION, context),
    deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CHAT_SESSION, sessionId),
    open: (context?: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_CHAT_WINDOW, context),
    showDailyPlanNotification: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_DAILY_PLAN_NOTIFICATION)
  },

  // Notifications API
  notifications: {
    getStats: () => ipcRenderer.invoke(IPC_CHANNELS.GET_NOTIFICATION_STATS),
    getRecent: (minutes?: number) => ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_NOTIFICATIONS, minutes)
  },

  // Python Server API
  pythonServer: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PYTHON_SERVER_GET_STATUS),
    getUrl: () => ipcRenderer.invoke(IPC_CHANNELS.PYTHON_SERVER_GET_URL),
    healthCheck: () => ipcRenderer.invoke(IPC_CHANNELS.PYTHON_SERVER_HEALTH_CHECK),
    apiRequest: (method: string, endpoint: string, data?: any) => 
      ipcRenderer.invoke(IPC_CHANNELS.PYTHON_SERVER_API_REQUEST, { method, endpoint, data })
  },

  // Gamification API
  gamification: {
    getData: () => ipcRenderer.invoke(IPC_CHANNELS.GET_GAMIFICATION_DATA),
    awardPoints: (points: number, type: string, description: string, metadata?: any) => 
      ipcRenderer.invoke(IPC_CHANNELS.AWARD_POINTS, { points, type, description, metadata }),
    unlockTheme: (themeId: string) => ipcRenderer.invoke(IPC_CHANNELS.UNLOCK_THEME, themeId),
    setDockTheme: (themeId: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_DOCK_THEME, themeId),
    applyTheme: (themeId: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_DOCK_THEME, themeId),
    completeQuest: (questId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMPLETE_QUEST, questId),
    earnBadge: (badgeId: string) => ipcRenderer.invoke(IPC_CHANNELS.EARN_BADGE, badgeId),
    checkFirstTimeSettings: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FIRST_TIME_SETTINGS),
    getThemes: () => ipcRenderer.invoke(IPC_CHANNELS.GET_GAMIFICATION_DATA).then((result: any) => ({ 
      success: result.success, 
      data: result.data?.availableThemes,
      error: result.error 
    })),
    onPointsEarned: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.POINT_EARNED_NOTIFICATION, (event: any, data: any) => callback(data));
    },
    onQuestCompleted: (callback: (quest: any) => void) => {
      ipcRenderer.on('quest-completed', (event: any, quest: any) => callback(quest));
    },
    onBadgeEarned: (callback: (badge: any) => void) => {
      ipcRenderer.on('badge-earned', (event: any, badge: any) => callback(badge));
    },
    onDockThemeChanged: (callback: (theme: any) => void) => {
      ipcRenderer.on('dock-theme-changed', (event: any, theme: any) => callback(theme));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.POINT_EARNED_NOTIFICATION);
      ipcRenderer.removeAllListeners('quest-completed');
      ipcRenderer.removeAllListeners('badge-earned');
      ipcRenderer.removeAllListeners('dock-theme-changed');
    }
  }
});