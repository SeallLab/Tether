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
  APPLICATION_CHANGE = 'application_change',
  AMBIENT_NOISE = 'ambient_noise',
  FOCUS_NOTIFICATION = 'focus_notification',
  CHAT_INTERACTION = 'chat_interaction'
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

export interface AmbientNoiseData {
  noise_level: number; // 0-100 scale
  peak_level: number; // Maximum level in this sample
  average_level: number; // Average level over sample period
  duration_ms: number; // Sample duration in milliseconds
  timestamp: number; // When this sample was taken
  is_quiet: boolean; // Whether it's considered "quiet" based on threshold
}

export interface FocusNotificationData {
  trigger: 'idle_threshold_reached';
  idle_duration: number;
  last_activity: string;
  message: string;
  should_notify: boolean;
  context: {
    recent_windows: string[];
    session_duration: number;
    focus_loss_reason?: string;
  };
}

export interface ChatInteractionData {
  sender: 'user' | 'assistant';
  message: string;
  sessionId: string;
  messageId: string;
}

export type ActivityData = TypingData | MouseData | IdleData | ScreenData | WindowData | AmbientNoiseData | FocusNotificationData | ChatInteractionData;

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

export interface LLMResponse {
  type: 'GET_FOCUS_BACK';
  should_notify: boolean;
  message: string;
  confidence: number;
  reasoning: string;
}

export interface LLMProvider {
  name: string;
  generateResponse(prompt: string): Promise<LLMResponse>;
}

// Chat-related types
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: number;
  sessionId: string;
}

export interface ChatSession {
  id: string;
  title: string;
  context: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  messageId: string;
} 