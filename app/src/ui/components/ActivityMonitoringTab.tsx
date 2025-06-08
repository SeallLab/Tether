import React from 'react';
import type { MonitoringConfig, ActivityStatus } from '../types/settings';

interface ActivityMonitoringTabProps {
  status: ActivityStatus | null;
  isLoading: boolean;
  error: string | null;
  onStartMonitoring: () => Promise<void>;
  onStopMonitoring: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onConfigChange: (key: keyof MonitoringConfig, value: string | number | boolean) => Promise<void>;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

export function ActivityMonitoringTab({
  status,
  isLoading,
  error,
  onStartMonitoring,
  onStopMonitoring,
  onRefreshStatus,
  onConfigChange
}: ActivityMonitoringTabProps) {
  return (
    <div className="p-6 space-y-6 min-h-full">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        Activity Monitoring Configuration
      </h3>
      
      {/* Monitoring Status */}
      <div className={`p-4 rounded-lg border ${
        status?.started 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${
            status?.started ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className={`font-medium ${
            status?.started ? 'text-green-800' : 'text-red-800'
          }`}>
            Status: {status?.started ? 'Active' : 'Stopped'}
          </span>
        </div>
        {status?.sessionId && (
          <div className="text-sm text-gray-600 mb-4">
            Session ID: {status.sessionId}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={status?.started ? onStopMonitoring : onStartMonitoring}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              status?.started
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Processing...' : status?.started ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
          <button
            onClick={onRefreshStatus}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <span className="font-medium text-red-800">Error:</span>
          <span className="text-red-700 ml-2">{error}</span>
        </div>
      )}

      {/* Show message if no config is available */}
      {!status?.config && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="font-medium text-yellow-800">Notice:</span>
          <span className="text-yellow-700 ml-2">Configuration not yet loaded. Please wait or try refreshing.</span>
        </div>
      )}

      {/* Monitor Types - only show if config is available */}
      {status?.config && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Monitor Types</h4>
          <div className="space-y-3">
            {[
              { key: 'idle_enabled', label: 'Idle Detection', description: 'Track when user becomes inactive' },
              { key: 'window_enabled', label: 'Window Monitoring', description: 'Track active applications and windows' },
              { key: 'typing_enabled', label: 'Typing Activity', description: 'Monitor keyboard activity (requires native modules)' },
              { key: 'mouse_enabled', label: 'Mouse Activity', description: 'Monitor mouse movements and clicks (requires native modules)' },
              { key: 'screen_enabled', label: 'Screen Capture', description: 'Take periodic screenshots (privacy sensitive)' }
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{label}</div>
                  <div className="text-sm text-gray-600">{description}</div>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(status.config[key as keyof MonitoringConfig])}
                    onChange={(e) => onConfigChange(key as keyof MonitoringConfig, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    status.config[key as keyof MonitoringConfig] ? 'bg-blue-600' : 'bg-gray-300'
                  }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      status.config[key as keyof MonitoringConfig] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timing Configuration - only show if config is available */}
      {status?.config && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Timing Configuration</h4>
          <div className="space-y-4">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Idle Threshold: {formatDuration(status.config.idle_threshold || 300)}
              </label>
              <input
                type="range"
                min="30"
                max="1800"
                step="30"
                value={status.config.idle_threshold || 300}
                onChange={(e) => onConfigChange('idle_threshold', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-xs text-gray-600 mt-2">
                Time before user is considered idle (30s - 30m)
              </div>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Screenshot Interval: {formatDuration(status.config.screenshot_interval || 300)}
              </label>
              <input
                type="range"
                min="60"
                max="3600"
                step="60"
                value={status.config.screenshot_interval || 300}
                onChange={(e) => onConfigChange('screenshot_interval', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-xs text-gray-600 mt-2">
                Time between screenshots when enabled (1m - 1h)
              </div>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Log Batch Size: {status.config.log_batch_size || 100}
              </label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={status.config.log_batch_size || 100}
                onChange={(e) => onConfigChange('log_batch_size', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-xs text-gray-600 mt-2">
                Number of logs to batch before writing to disk
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Configuration - only show if config is available */}
      {status?.config && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Storage</h4>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Storage Path
            </label>
            <input
              type="text"
              value={status.config.storage_path || ''}
              onChange={(e) => onConfigChange('storage_path', e.target.value)}
              className="w-full text-black px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="text-xs text-gray-600 mt-2">
              Directory where activity logs are stored
            </div>
          </div>
        </div>
      )}

      {/* Active Monitors */}
      {status?.monitors && status.monitors.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Active Monitors</h4>
          <div className="space-y-2">
            {status.monitors.map((monitor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    monitor.running ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium text-gray-900">{monitor.name}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  monitor.running 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {monitor.running ? 'Running' : 'Stopped'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 