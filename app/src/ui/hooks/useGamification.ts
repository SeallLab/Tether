import { useState, useEffect, useCallback } from 'react';
import type { GamificationData, DockTheme, Badge, Quest } from '../../shared/types';

interface GamificationHook {
  data: GamificationData | null;
  themes: DockTheme[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  awardPoints: (points: number, reason: string) => Promise<boolean>;
  unlockTheme: (themeId: string) => Promise<boolean>;
  applyTheme: (themeId: string) => Promise<boolean>;
  updateBadgeProgress: (badgeId: string, progress: number) => Promise<boolean>;
  completeQuest: (questId: string) => Promise<boolean>;
}

export function useGamification(): GamificationHook {
  const [data, setData] = useState<GamificationData | null>(null);
  const [themes, setThemes] = useState<DockTheme[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: any, context: string) => {
    const errorMessage = err?.error || err?.message || String(err);
    console.error(`[Gamification] ${context}:`, err);
    setError(`${context}: ${errorMessage}`);
  }, []);

  const refreshData = useCallback(async () => {
    if (!window.electron?.gamification) {
      setError('Gamification API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load gamification data
      const dataResult = await window.electron.gamification.getData();
      if (dataResult.success && dataResult.data) {
        setData(dataResult.data);
      } else {
        handleError(dataResult, 'Failed to load gamification data');
      }

      // Load themes
      const themesResult = await window.electron.gamification.getThemes();
      if (themesResult.success && themesResult.data) {
        setThemes(themesResult.data);
      } else {
        console.warn('Failed to load themes:', themesResult.error);
      }
    } catch (err) {
      handleError(err, 'Error loading gamification data');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const awardPoints = useCallback(async (points: number, reason: string): Promise<boolean> => {
    if (!window.electron?.gamification) return false;

    try {
      const result = await window.electron.gamification.awardPoints(points, reason);
      if (result.success) {
        await refreshData();
        return true;
      } else {
        handleError(result, 'Failed to award points');
        return false;
      }
    } catch (err) {
      handleError(err, 'Error awarding points');
      return false;
    }
  }, [refreshData, handleError]);

  const unlockTheme = useCallback(async (themeId: string): Promise<boolean> => {
    if (!window.electron?.gamification) return false;

    try {
      const result = await window.electron.gamification.unlockTheme(themeId);
      if (result.success) {
        await refreshData();
        return true;
      } else {
        handleError(result, 'Failed to unlock theme');
        return false;
      }
    } catch (err) {
      handleError(err, 'Error unlocking theme');
      return false;
    }
  }, [refreshData, handleError]);

  const applyTheme = useCallback(async (themeId: string): Promise<boolean> => {
    if (!window.electron?.gamification) return false;

    try {
      const result = await window.electron.gamification.applyTheme(themeId);
      if (result.success) {
        return true;
      } else {
        handleError(result, 'Failed to apply theme');
        return false;
      }
    } catch (err) {
      handleError(err, 'Error applying theme');
      return false;
    }
  }, [handleError]);

  const updateBadgeProgress = useCallback(async (badgeId: string, progress: number): Promise<boolean> => {
    if (!window.electron?.gamification) return false;

    try {
      const result = await window.electron.gamification.updateBadgeProgress(badgeId, progress);
      if (result.success) {
        await refreshData();
        return true;
      } else {
        handleError(result, 'Failed to update badge progress');
        return false;
      }
    } catch (err) {
      handleError(err, 'Error updating badge progress');
      return false;
    }
  }, [refreshData, handleError]);

  const completeQuest = useCallback(async (questId: string): Promise<boolean> => {
    if (!window.electron?.gamification) return false;

    try {
      const result = await window.electron.gamification.completeQuest(questId);
      if (result.success) {
        await refreshData();
        return true;
      } else {
        handleError(result, 'Failed to complete quest');
        return false;
      }
    } catch (err) {
      handleError(err, 'Error completing quest');
      return false;
    }
  }, [refreshData, handleError]);

  // Load initial data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    data,
    themes,
    isLoading,
    error,
    refreshData,
    awardPoints,
    unlockTheme,
    applyTheme,
    updateBadgeProgress,
    completeQuest
  };
} 