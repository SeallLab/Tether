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
  idle_enabled: boolean;
  screen_enabled: boolean;
  window_enabled: boolean;
  idle_threshold: number;
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
export type ChatMode = 'planner' | 'builder' | 'detective' | 'reviewer' | 'general';
export type DetectiveMode = 'teaching' | 'quick-fix';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: number;
  sessionId: string;
  mode?: ChatMode;
  checklistId?: string;
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
  mode?: ChatMode;
  detectiveMode?: DetectiveMode;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  messageId: string;
}

export interface ChecklistItem {
  id: string;
  taskText: string;
  isCompleted: boolean;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Checklist {
  messageId: string;
  sessionId: string;
  items: ChecklistItem[];
}

export interface GamificationData {
  points: number;
  level: number;
  totalPointsEarned: number;
  currentDockTheme: string;
  unlockedThemes: string[];
  badges: Badge[];
  quests: Quest[];
  lastPointsEarned: number;
  lastActivityTime: number;
  streaks: {
    dailyFocus: number;
    weeklyFocus: number;
    longestStreak: number;
  };
  achievements: Achievement[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: number | null;
  progress?: number;
  maxProgress?: number;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'milestone' | 'special';
  progress: number;
  maxProgress: number;
  reward: QuestReward;
  isCompleted: boolean;
  completedAt: number | null;
  expiresAt: number | null;
}

export interface QuestReward {
  type: 'points' | 'badge' | 'theme' | 'experience';
  value: number | string;
  description: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  pointsAwarded: number;
  earnedAt: number;
  trigger: string;
  metadata?: Record<string, any>;
}

export interface DockTheme {
  id: string;
  name: string;
  description: string;
  previewColor: string;
  backgroundColor: string;
  borderColor?: string;
  glowColor?: string;
  unlockCost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  gradient?: {
    from: string;
    to: string;
    direction?: string;
  };
  special?: {
    animated?: boolean;
    pattern?: string;
    shimmer?: boolean;
  };
}

export interface PointEarningEvent {
  id: string;
  type: 'focus_session' | 'streak_bonus' | 'quest_completion' | 'achievement_unlock' | 'daily_login';
  points: number;
  description: string;
  timestamp: number;
  metadata?: Record<string, any>;
} 