export const IPC_CHANNELS = {
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
} as const;