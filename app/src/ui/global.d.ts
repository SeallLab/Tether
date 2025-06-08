export {};

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        once: (channel: string, listener: (...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      };
      activityMonitoring: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getRecentActivity: (minutes?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        updateConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
      };
      settings: {
        getAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
        update: (section: string, settings: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        reset: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getPath: () => Promise<{ success: boolean; data?: string; error?: string }>;
      };
      llm: {
        setApiKey: (apiKey: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
        onFocusNotification: (callback: (response: any) => void) => void;
        removeAllListeners: () => void;
      };
      dock: {
        toggle: () => Promise<{ success: boolean; visible?: boolean; error?: string }>;
      };
      chat: {
        sendMessage: (request: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getSessions: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getHistory: (sessionId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        createSession: (context?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        deleteSession: (sessionId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        open: (context?: string) => Promise<{ success: boolean; error?: string }>;
        showDailyPlanNotification: () => Promise<{ success: boolean; error?: string }>;
      };
      notifications: {
        getStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getRecent: (minutes?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      };
    }
  }
} 