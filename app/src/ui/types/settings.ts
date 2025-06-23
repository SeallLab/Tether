import type { MonitoringConfig } from '../../shared/types';

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

export type TabType = 'activity' | 'llm' | 'rewards' | 'general' | 'about';