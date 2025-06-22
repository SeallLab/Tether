import React, { useState, useEffect } from 'react';
import { Button, StatusBadge } from '../../components/common';
import type { GamificationData } from '../../../shared/types';
import { BadgesTab, QuestsTab, StatsTab, ThemesTab } from './components';

type RewardsTabType = 'stats' | 'themes' | 'badges' | 'quests';

const tabs = [
  { 
    id: 'stats' as RewardsTabType, 
    label: 'Stats', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  { 
    id: 'themes' as RewardsTabType, 
    label: 'Themes', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )
  },
  { 
    id: 'badges' as RewardsTabType, 
    label: 'Badges', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    )
  },
  { 
    id: 'quests' as RewardsTabType, 
    label: 'Quests', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  }
];

export function RewardsPage() {
  const [activeTab, setActiveTab] = useState<RewardsTabType>('stats');
  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGamificationData = async () => {
    if (!window.electron?.gamification) {
      setError('Gamification API not available');
      setIsLoading(false);
      return;
    }

    try {
      const result = await window.electron.gamification.getData();
      if (result.success && result.data) {
        setGamificationData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load gamification data');
      }
    } catch (err) {
      setError(`Error loading data: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGamificationData();
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    loadGamificationData();
  };

  const renderTabContent = () => {
    if (!gamificationData) return null;

    switch (activeTab) {
      case 'stats':
        return (
          <StatsTab 
            data={gamificationData} 
            onRefresh={handleRefresh}
          />
        );
      case 'themes':
        return (
          <ThemesTab 
            data={gamificationData} 
            onThemeUnlock={handleRefresh}
            onThemeApply={handleRefresh}
          />
        );
      case 'badges':
        return (
          <BadgesTab 
            badges={gamificationData.badges}
          />
        );
      case 'quests':
        return (
          <QuestsTab 
            quests={gamificationData.quests}
            onRefresh={handleRefresh}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-700 mb-2">Loading Rewards...</h2>
          <p className="text-gray-600">Fetching your achievements and progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gray-700">Rewards & Progress</h1>
          {gamificationData && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{gamificationData.points}</div>
                <div className="text-sm text-gray-600">Points</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">{gamificationData.level}</div>
                <div className="text-sm text-gray-600">Level</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-8 flex-shrink-0">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`bg-white group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className={`mr-2 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-8">
            <StatusBadge
              status="error"
              label="Error"
              description={error}
            />
            <Button onClick={handleRefresh} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  );
} 