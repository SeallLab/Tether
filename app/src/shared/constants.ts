export const IPC_CHANNELS = {
  OPEN_SETTINGS_WINDOW: 'open-settings-window',
  
  // Activity Monitoring
  START_ACTIVITY_MONITORING: 'start-activity-monitoring',
  STOP_ACTIVITY_MONITORING: 'stop-activity-monitoring',
  GET_ACTIVITY_STATUS: 'get-activity-status',
  GET_RECENT_ACTIVITY: 'get-recent-activity',
  UPDATE_MONITORING_CONFIG: 'update-monitoring-config'
} as const;