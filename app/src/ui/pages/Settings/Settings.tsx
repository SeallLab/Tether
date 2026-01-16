import React, { useState, useEffect } from 'react';
import { useActivityMonitoring } from '../../hooks/useActivityMonitoring';
import { 
  LoadingScreen 
} from '../../components';
import { TabNavigation, ActivityMonitoringTab } from './components';
import type { TabType, LLMStatus } from '../../types/settings';
import { RewardsPage } from '../Rewards';
import type { MonitoringConfig } from '../../../shared/types';

const tabs = [
  { 
    id: 'activity' as TabType, 
    label: 'Monitoring', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  { 
    id: 'rewards' as TabType, 
    label: 'Rewards', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    )
  },
];

function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const { 
    status, 
    isLoading, 
    error, 
    startMonitoring, 
    stopMonitoring, 
    updateConfig,
    refreshStatus 
  } = useActivityMonitoring();

  // Load initial data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitialLoading(true);
      
      // Load LLM status
      if (window.electron?.llm) {
        try {
          const result = await window.electron.llm.getStatus();
          if (result.success) {
            setLLMStatus(result.data);
          }
        } catch (error) {
          console.error('Failed to load LLM status:', error);
        }
      }
      
      // Check for first time settings open achievement
      if (window.electron?.gamification?.checkFirstTimeSettings) {
        try {
          const result = await window.electron.gamification.checkFirstTimeSettings();
          if (result.success && result.data?.firstTime) {
            console.log('🎉 First time opening settings! Badge earned:', result.data.badge);
          }
        } catch (error) {
          console.error('Error checking first time settings:', error);
        }
      }
      
      // Ensure activity monitoring status is loaded
      await refreshStatus();
      
      setIsInitialLoading(false);
    };
    
    loadInitialData();
  }, [refreshStatus]);

  const handleConfigChange = async (key: keyof MonitoringConfig, value: string | number | boolean) => {
    if (!status?.config) return;
    
    const newConfig = {
      ...status.config,
      [key]: value
    };
    
    await updateConfig(newConfig);
  };

  // Show loading state while initial data is being fetched
  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <ActivityMonitoringTab
            status={status}
            isLoading={isLoading}
            error={error}
            onStartMonitoring={startMonitoring}
            onStopMonitoring={stopMonitoring}
            onRefreshStatus={refreshStatus}
            onConfigChange={handleConfigChange}
          />
        );
      case 'rewards':
        return (
          <div className="h-full bg-gray-50">
            <RewardsPage />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 font-sans min-h-screen pt-2 bg-white">
      <TabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 min-h-0">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default Settings; 