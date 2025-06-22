export const IPC_CHANNELS = {
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

  // Notifications
  GET_NOTIFICATION_STATS: 'get-notification-stats',
  GET_RECENT_NOTIFICATIONS: 'get-recent-notifications',
  
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

  // Window Handlers
  UPDATE_CHILD_WINDOW_OPTIONS: 'update-child-window-options',
  
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