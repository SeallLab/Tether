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
    }
  }
} 