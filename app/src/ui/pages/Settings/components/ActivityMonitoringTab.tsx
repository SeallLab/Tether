import React from 'react';
import { Button, Toggle, Slider, Input, StatusBadge, Card } from '../../../components/common';
import type { ActivityStatus } from '../../../types/settings';
import type { MonitoringConfig } from '../../../../shared/types';

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

const monitorTypes = [
  { 
    key: 'idle_enabled' as keyof MonitoringConfig, 
    label: 'Idle Detection', 
    description: 'Track when user becomes inactive' 
  },
  { 
    key: 'window_enabled' as keyof MonitoringConfig, 
    label: 'Window Monitoring', 
    description: 'Track active applications and windows' 
  },
];

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
      <StatusBadge
        status={status?.started ? 'active' : 'inactive'}
        label={`Status: ${status?.started ? 'Active' : 'Stopped'}`}
        description={status?.sessionId ? `Session ID: ${status.sessionId}` : undefined}
      />

      <div className="flex gap-3">
        <Button
          variant={status?.started ? 'danger' : 'success'}
          onClick={status?.started ? onStopMonitoring : onStartMonitoring}
          isLoading={isLoading}
        >
          {status?.started ? 'Stop Monitoring' : 'Start Monitoring'}
        </Button>
        <Button
          variant="secondary"
          onClick={onRefreshStatus}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <StatusBadge
          status="error"
          label="Error"
          description={error}
        />
      )}

      {/* Show message if no config is available */}
      {!status?.config && (
        <StatusBadge
          status="warning"
          label="Notice"
          description="Configuration not yet loaded. Please wait or try refreshing."
        />
      )}

      {/* Monitor Types - only show if config is available */}
      {status?.config && (
        <Card title="Monitor Types">
          <div className="space-y-3">
            {monitorTypes.map(({ key, label, description }) => (
              <Card key={key} padding="md" variant="outlined">
                <Toggle
                  checked={Boolean(status.config[key])}
                  onChange={(checked) => onConfigChange(key, checked)}
                  label={label}
                  description={description}
                />
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Timing Configuration - only show if config is available */}
      {status?.config && (
        <Card title="Timing Configuration">
          <div className="space-y-4">
            <Card padding="md" variant="outlined">
              <Slider
                label="Idle Threshold"
                min={30}
                max={1800}
                step={30}
                value={status.config.idle_threshold || 300}
                onChange={(e) => onConfigChange('idle_threshold', parseInt(e.target.value))}
                formatValue={formatDuration}
                description="Time before user is considered idle (30s - 30m)"
                fullWidth
              />
            </Card>

            <Card padding="md" variant="outlined">
              <Slider
                label="Log Batch Size"
                min={10}
                max={1000}
                step={10}
                value={status.config.log_batch_size || 100}
                onChange={(e) => onConfigChange('log_batch_size', parseInt(e.target.value))}
                description="Number of logs to batch before writing to disk"
                fullWidth
              />
            </Card>
          </div>
        </Card>
      )}

      {/* Storage Configuration - only show if config is available */}
      {status?.config && (
        <Card title="Storage">
          <Input
            label="Storage Path"
            value={status.config.storage_path || ''}
            onChange={(e) => onConfigChange('storage_path', e.target.value)}
            description="Directory where activity logs are stored"
            fullWidth
          />
        </Card>
      )}

      {/* Active Monitors */}
      {status?.monitors && status.monitors.length > 0 && (
        <Card title="Active Monitors">
          <div className="space-y-2">
            {status.monitors.map((monitor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="font-medium text-gray-900">{monitor.name}</span>
                <StatusBadge
                  status={monitor.running ? 'active' : 'inactive'}
                  label={monitor.running ? 'Running' : 'Stopped'}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
} 