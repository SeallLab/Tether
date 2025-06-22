import React from 'react';
import { Button, Input, StatusBadge, Card } from '../../../components/common';

interface LLMStatus {
  enabled: boolean;
  provider?: string;
}

interface LLMAssistantTabProps {
  llmStatus: LLMStatus | null;
  apiKey: string;
  isUpdatingLLM: boolean;
  llmMessage: string;
  onApiKeyChange: (value: string) => void;
  onApiKeyUpdate: () => Promise<void>;
}

const features = [
  {
    title: 'Smart Focus Notifications',
    description: 'Get personalized reminders when you\'ve been idle, tailored to your work context',
  },
  {
    title: 'Activity Pattern Analysis',
    description: 'AI analyzes your work patterns to provide insights and suggestions',
  },
  {
    title: 'Context-Aware Messaging',
    description: 'Notifications reference what you were working on before becoming idle',
  }
];

export function LLMAssistantTab({
  llmStatus,
  apiKey,
  isUpdatingLLM,
  llmMessage,
  onApiKeyChange,
  onApiKeyUpdate
}: LLMAssistantTabProps) {
  return (
    <div className="p-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        AI Assistant Configuration
      </h3>
      
      {/* LLM Status */}
      <StatusBadge
        status={llmStatus?.enabled ? 'active' : 'warning'}
        label={`AI Assistant: ${llmStatus?.enabled ? 'Active' : 'Inactive'}`}
        description={llmStatus?.provider ? `Provider: ${llmStatus.provider}` : undefined}
      />

      {/* API Key Configuration */}
      <Card title="Google Gemini API Key">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Enter your Gemini API key..."
              fullWidth
            />
            <Button
              onClick={onApiKeyUpdate}
              isLoading={isUpdatingLLM}
              disabled={!apiKey.trim()}
            >
              Update
            </Button>
          </div>
          
          {llmMessage && (
            <StatusBadge
              status={llmMessage.includes('success') ? 'success' : 'error'}
              label={llmMessage.includes('success') ? 'Success' : 'Error'}
              description={llmMessage}
              size="sm"
            />
          )}
          
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              The AI assistant analyzes your activity patterns and provides intelligent focus notifications.
            </p>
            <p>
              Get your free API key from:{' '}
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card title="AI Features">
        <div className="space-y-3">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              padding="md" 
              className={`transition-opacity ${llmStatus?.enabled ? 'opacity-100' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full ${
                  llmStatus?.enabled ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="font-medium text-gray-900">{feature.title}</span>
              </div>
              <div className="text-sm text-gray-600">
                {feature.description}
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
} 