import React from 'react';
import type { LLMStatus } from '../types/settings';

interface LLMAssistantTabProps {
  llmStatus: LLMStatus | null;
  apiKey: string;
  isUpdatingLLM: boolean;
  llmMessage: string;
  onApiKeyChange: (value: string) => void;
  onApiKeyUpdate: () => Promise<void>;
}

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
      <div className={`p-4 rounded-lg border ${
        llmStatus?.enabled 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            llmStatus?.enabled ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span className={`font-medium ${
            llmStatus?.enabled ? 'text-green-800' : 'text-yellow-800'
          }`}>
            AI Assistant: {llmStatus?.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
        {llmStatus?.provider && (
          <div className="text-sm text-gray-600">
            Provider: {llmStatus.provider}
          </div>
        )}
      </div>

      {/* API Key Configuration */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Google Gemini API Key</h4>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              API Key
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={onApiKeyUpdate}
                disabled={isUpdatingLLM || !apiKey.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingLLM ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
          
          {llmMessage && (
            <div className={`p-3 rounded-md text-sm ${
              llmMessage.includes('success') 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {llmMessage}
            </div>
          )}
          
          <div className="text-sm text-gray-600 mt-4 space-y-2">
            <p>
              The AI assistant analyzes your activity patterns and provides intelligent focus notifications.
            </p>
            <p>
              Get your free API key from: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Google AI Studio</a>
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">AI Features</h4>
        <div className="space-y-3">
          {[
            {
              title: 'Smart Focus Notifications',
              description: 'Get personalized reminders when you\'ve been idle, tailored to your work context',
              enabled: llmStatus?.enabled || false
            },
            {
              title: 'Activity Pattern Analysis',
              description: 'AI analyzes your work patterns to provide insights and suggestions',
              enabled: llmStatus?.enabled || false
            },
            {
              title: 'Context-Aware Messaging',
              description: 'Notifications reference what you were working on before becoming idle',
              enabled: llmStatus?.enabled || false
            }
          ].map((feature, index) => (
            <div key={index} className={`p-4 bg-white border border-gray-200 rounded-lg transition-opacity ${
              feature.enabled ? 'opacity-100' : 'opacity-60'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full ${
                  feature.enabled ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="font-medium text-gray-900">{feature.title}</span>
              </div>
              <div className="text-sm text-gray-600">
                {feature.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 