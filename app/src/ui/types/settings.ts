export interface MonitoringConfig {
  typing_enabled: boolean;
  mouse_enabled: boolean;
  idle_enabled: boolean;
  screen_enabled: boolean;
  window_enabled: boolean;
  screenshot_interval: number;
  idle_threshold: number;
  log_batch_size: number;
  storage_path: string;
}

export interface ActivityStatus {
  started: boolean;
  sessionId: string;
  monitors: Array<{ name: string; running: boolean }>;
  config: MonitoringConfig;
}

export interface LLMStatus {
  enabled: boolean;
  provider?: string;
}

export type TabType = 'activity' | 'llm' | 'general' | 'about'; 