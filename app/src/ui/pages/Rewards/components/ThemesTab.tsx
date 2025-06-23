import React, { useState, useEffect } from 'react';
import { Card, Button, StatusBadge } from '../../../components/common';
import type { GamificationData, DockTheme } from '../../../../shared/types';

type ExtendedDockTheme = DockTheme & { 
  isUnlocked: boolean; 
  canAfford: boolean; 
};

interface ThemesTabProps {
  data: GamificationData;
  onThemeUnlock: () => void;
  onThemeApply: (themeId: string) => void;
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common': return 'text-gray-600 bg-gray-100';
    case 'rare': return 'text-blue-600 bg-blue-100';
    case 'epic': return 'text-purple-600 bg-purple-100';
    case 'legendary': return 'text-yellow-600 bg-yellow-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export function ThemesTab({ data, onThemeUnlock, onThemeApply }: ThemesTabProps) {
  const [themes, setThemes] = useState<ExtendedDockTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unlockingTheme, setUnlockingTheme] = useState<string | null>(null);
  const [applyingTheme, setApplyingTheme] = useState<string | null>(null);

  const loadThemes = async () => {
    if (!window.electron?.gamification) return;

    try {
      const result = await window.electron.gamification.getThemes();
      if (result.success && result.data) {
        setThemes(result.data);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, [data.unlockedThemes]);

  const handleUnlockTheme = async (theme: ExtendedDockTheme) => {
    if (!window.electron?.gamification || !theme.canAfford) return;

    setUnlockingTheme(theme.id);
    try {
      const result = await window.electron.gamification.unlockTheme(theme.id);
      if (result.success) {
        onThemeUnlock();
        await loadThemes();
      }
    } catch (error) {
      console.error('Failed to unlock theme:', error);
    } finally {
      setUnlockingTheme(null);
    }
  };

  const handleApplyTheme = async (themeId: string) => {
    if (!window.electron?.gamification) return;

    setApplyingTheme(themeId);
    try {
      const result = await window.electron.gamification.applyTheme(themeId);
      if (result.success) {
        // Refresh the main gamification data to get updated currentDockTheme
        onThemeApply(themeId);
        // Also reload themes to get fresh data
        await loadThemes();
      } else {
        console.error('Failed to apply theme:', result.error);
      }
    } catch (error) {
      console.error('Failed to apply theme:', error);
    } finally {
      setApplyingTheme(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-pulse text-gray-500">Loading themes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Dock Themes</h3>
        <div className="flex items-center space-x-4">
          <Button onClick={loadThemes} variant="secondary" size="sm">
            Refresh
          </Button>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600">{data.points}</div>
            <div className="text-sm text-gray-600">Available Points</div>
          </div>
        </div>
      </div>

      {/* Current Theme Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="text-lg">🎨</div>
          <div>
            <div className="text-sm font-medium text-blue-900">Current Theme</div>
            <div className="text-blue-700">
              {themes.find(t => t.id === data.currentDockTheme)?.name || 'Unknown Theme'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((theme) => (
          <Card key={theme.id} className="relative overflow-hidden">
            {/* Theme Preview */}
            <div 
              className="h-20 w-full rounded-lg mb-4 relative"
              style={{ backgroundColor: theme.backgroundColor }}
            >
              {theme.gradient && (
                <div 
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: `linear-gradient(${theme.gradient.direction || '45deg'}, ${theme.gradient.from}, ${theme.gradient.to})`
                  }}
                />
              )}
              {theme.special?.shimmer && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-lg animate-pulse" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-sm font-medium opacity-80">
                  {theme.name}
                </div>
              </div>
            </div>

            {/* Theme Info */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{theme.name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRarityColor(theme.rarity)}`}>
                    {theme.rarity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
              </div>

            
              {/* Actions */}
              <div className="pt-2">
                {theme.isUnlocked ? (
                  <div className="space-y-2">
                    {data.currentDockTheme === theme.id ? (
                      <StatusBadge 
                        status="success" 
                        label="Currently Active" 
                        size="sm"
                      />
                    ) : (
                      <StatusBadge 
                        status="success" 
                        label="Unlocked" 
                        size="sm"
                      />
                    )}
                    <Button
                      onClick={() => handleApplyTheme(theme.id)}
                      isLoading={applyingTheme === theme.id}
                      disabled={data.currentDockTheme === theme.id}
                      variant={data.currentDockTheme === theme.id ? "secondary" : "primary"}
                      size="sm"
                      className="w-full"
                    >
                      {data.currentDockTheme === theme.id ? 'Active Theme' : 'Apply Theme'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-medium text-blue-600">{theme.unlockCost} points</span>
                    </div>
                    <Button
                      onClick={() => handleUnlockTheme(theme)}
                      isLoading={unlockingTheme === theme.id}
                      disabled={!theme.canAfford}
                      variant={theme.canAfford ? "primary" : "secondary"}
                      size="sm"
                      className="w-full"
                    >
                      {theme.canAfford ? 'Unlock' : 'Not Enough Points'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {themes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🎨</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Themes Available</h3>
          <p className="text-gray-600">Themes will be available once the gamification service is running.</p>
        </div>
      )}
    </div>
  );
} 