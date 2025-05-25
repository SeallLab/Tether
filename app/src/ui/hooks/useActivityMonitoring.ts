import { useState, useEffect, useCallback } from 'react';

interface ActivityStatus {
  started: boolean;
  sessionId: string;
  monitors: Array<{ name: string; running: boolean }>;
  config: any;
}

interface ActivityMonitoringHook {
  status: ActivityStatus | null;
  isLoading: boolean;
  error: string | null;
  recentActivity: any[] | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  getRecentActivity: (minutes?: number) => Promise<void>;
  updateConfig: (config: any) => Promise<void>;
}

export function useActivityMonitoring(): ActivityMonitoringHook {
  const [status, setStatus] = useState<ActivityStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: any, context: string) => {
    const errorMessage = err?.error || err?.message || String(err);
    console.error(`[ActivityMonitoring] ${context}:`, err);
    setError(`${context}: ${errorMessage}`);
  }, []);

  const startMonitoring = useCallback(async () => {
    if (!window.electron?.activityMonitoring) {
      setError('Activity monitoring API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.activityMonitoring.start();
      if (!result.success) {
        handleError(result, 'Failed to start monitoring');
      } else {
        await refreshStatus();
      }
    } catch (err) {
      handleError(err, 'Error starting monitoring');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const stopMonitoring = useCallback(async () => {
    if (!window.electron?.activityMonitoring) {
      setError('Activity monitoring API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.activityMonitoring.stop();
      if (!result.success) {
        handleError(result, 'Failed to stop monitoring');
      } else {
        await refreshStatus();
      }
    } catch (err) {
      handleError(err, 'Error stopping monitoring');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const refreshStatus = useCallback(async () => {
    if (!window.electron?.activityMonitoring) {
      setError('Activity monitoring API not available');
      return;
    }

    try {
      const result = await window.electron.activityMonitoring.getStatus();
      if (result.success && result.data) {
        setStatus(result.data);
        setError(null);
      } else {
        handleError(result, 'Failed to get status');
      }
    } catch (err) {
      handleError(err, 'Error getting status');
    }
  }, [handleError]);

  const getRecentActivity = useCallback(async (minutes: number = 60) => {
    if (!window.electron?.activityMonitoring) {
      setError('Activity monitoring API not available');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electron.activityMonitoring.getRecentActivity(minutes);
      if (result.success && result.data) {
        setRecentActivity(result.data);
        setError(null);
      } else {
        handleError(result, 'Failed to get recent activity');
      }
    } catch (err) {
      handleError(err, 'Error getting recent activity');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const updateConfig = useCallback(async (config: any) => {
    if (!window.electron?.activityMonitoring) {
      setError('Activity monitoring API not available');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electron.activityMonitoring.updateConfig(config);
      if (!result.success) {
        handleError(result, 'Failed to update config');
      } else {
        await refreshStatus();
      }
    } catch (err) {
      handleError(err, 'Error updating config');
    } finally {
      setIsLoading(false);
    }
  }, [handleError, refreshStatus]);

  // Load initial status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    recentActivity,
    isLoading,
    error,
    startMonitoring,
    stopMonitoring,
    refreshStatus,
    getRecentActivity,
    updateConfig
  };
} 