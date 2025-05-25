export interface ActivityLog {
  id: string;
  timestamp: number;
  type: ActivityType;
  data: ActivityData;
  session_id: string;
}

export enum ActivityType {
  TYPING = 'typing',
  MOUSE = 'mouse',
  IDLE = 'idle',
  SCREEN_CHANGE = 'screen_change',
  WINDOW_CHANGE = 'window_change',
  APPLICATION_CHANGE = 'application_change'
}

export interface TypingData {
  key_count: number;
  words_per_minute?: number;
  active_application: string;
  active_window_title: string;
}

export interface MouseData {
  clicks: number;
  movements: number;
  scroll_events: number;
  position?: { x: number; y: number };
}

export interface IdleData {
  idle_duration: number; // in seconds
  was_idle: boolean;
  resume_trigger: 'mouse' | 'keyboard' | 'unknown';
}

export interface ScreenData {
  screenshot_path?: string;
  screen_resolution: { width: number; height: number };
  active_monitors: number;
}

export interface WindowData {
  application_name: string;
  window_title: string;
  window_bounds?: { x: number; y: number; width: number; height: number };
  process_name: string;
}

export type ActivityData = TypingData | MouseData | IdleData | ScreenData | WindowData;

export interface MonitoringConfig {
  typing_enabled: boolean;
  mouse_enabled: boolean;
  idle_enabled: boolean;
  screen_enabled: boolean;
  window_enabled: boolean;
  screenshot_interval: number; // in seconds
  idle_threshold: number; // in seconds
  log_batch_size: number;
  storage_path: string;
} 