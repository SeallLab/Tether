import React, { useState, useEffect } from 'react'
import './App.css'
import { useActivityMonitoring } from './hooks/useActivityMonitoring'
import { 
  ActivityMonitoringTab, 
  LLMAssistantTab, 
  GeneralTab, 
  AboutTab, 
  LoadingScreen 
} from './components'
import type { TabType, LLMStatus, MonitoringConfig } from './types/settings'

function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isUpdatingLLM, setIsUpdatingLLM] = useState(false);
  const [llmMessage, setLLMMessage] = useState('');
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

  const handleLLMApiKeyUpdate = async () => {
    if (!window.electron?.llm || !apiKey.trim()) return;
    
    setIsUpdatingLLM(true);
    setLLMMessage('');
    
    try {
      const result = await window.electron.llm.setApiKey(apiKey.trim());
      if (result.success) {
        setLLMStatus(result.data);
        setLLMMessage('API key updated successfully!');
        setApiKey('');
      } else {
        setLLMMessage(`Failed to update API key: ${result.error}`);
      }
    } catch (error) {
      setLLMMessage(`Error: ${error}`);
    } finally {
      setIsUpdatingLLM(false);
    }
  };

  const tabs = [
    { 
      id: 'activity' as TabType, 
      label: 'Activity Monitoring', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      id: 'llm' as TabType, 
      label: 'AI Assistant', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    { 
      id: 'general' as TabType, 
      label: 'General', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      id: 'about' as TabType, 
      label: 'About', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

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

      case 'llm':
        return (
          <LLMAssistantTab
            llmStatus={llmStatus}
            apiKey={apiKey}
            isUpdatingLLM={isUpdatingLLM}
            llmMessage={llmMessage}
            onApiKeyChange={setApiKey}
            onApiKeyUpdate={handleLLMApiKeyUpdate}
          />
        );

      case 'general':
        return <GeneralTab />;

      case 'about':
        return <AboutTab />;

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 font-sans min-h-screen">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-8 flex-shrink-0">
        <div className="flex space-x-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 bg-white ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 min-h-0">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Settings 