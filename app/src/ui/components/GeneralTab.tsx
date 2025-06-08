import React, { useState, useEffect } from 'react';
import { Button, Card, StatusBadge } from './common';

export function GeneralTab() {
  const [settingsPath, setSettingsPath] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    // Load settings path
    const loadSettingsPath = async () => {
      if (window.electron?.settings) {
        try {
          const result = await window.electron.settings.getPath();
          if (result.success && result.data) {
            setSettingsPath(result.data);
          }
        } catch (error) {
          console.error('Failed to load settings path:', error);
        }
      }
    };

    loadSettingsPath();
  }, []);

  const handleResetSettings = async () => {
    if (!window.electron?.settings) return;

    const confirmed = window.confirm(
      'Are you sure you want to reset all settings to defaults? This action cannot be undone.'
    );

    if (!confirmed) return;

    setIsResetting(true);
    setResetMessage('');

    try {
      const result = await window.electron.settings.reset();
      if (result.success) {
        setResetMessage('Settings reset successfully! Please restart the application for all changes to take effect.');
      } else {
        setResetMessage(`Failed to reset settings: ${result.error}`);
      }
    } catch (error) {
      setResetMessage(`Error: ${error}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        General Settings
      </h3>
      
      {/* Settings Information */}
      <Card title="Settings Information">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Settings File Location
            </label>
            <div className="p-3 bg-gray-50 rounded-md text-sm font-mono text-gray-700 break-all">
              {settingsPath || 'Loading...'}
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Your settings are automatically saved to this file when you make changes.
            </div>
          </div>
        </div>
      </Card>

      {/* Reset Settings */}
      <Card title="Reset Settings">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reset all settings to their default values. This will clear all your customizations including:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Activity monitoring configuration</li>
            <li>AI assistant API key</li>
            <li>UI preferences</li>
            <li>General application settings</li>
          </ul>
          
          <Button
            variant="danger"
            onClick={handleResetSettings}
            isLoading={isResetting}
          >
            Reset All Settings
          </Button>

          {resetMessage && (
            <StatusBadge
              status={resetMessage.includes('successfully') ? 'success' : 'error'}
              label={resetMessage.includes('successfully') ? 'Success' : 'Error'}
              description={resetMessage}
              size="sm"
            />
          )}
        </div>
      </Card>

      {/* Application Info */}
      <Card title="Application Information">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Version</span>
            <span className="text-sm text-gray-600">1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Platform</span>
            <span className="text-sm text-gray-600">{navigator.platform}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">User Agent</span>
            <span className="text-sm text-gray-600 truncate max-w-xs" title={navigator.userAgent}>
              {navigator.userAgent.split(' ')[0]}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
} 