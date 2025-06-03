import React from 'react';

export function AboutTab() {
  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        About Tether
      </h3>
      
      <div className="p-8 bg-white border border-gray-200 rounded-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h4 className="text-2xl font-semibold text-gray-900 mb-2">
            Tether
          </h4>
          <p className="text-gray-600">
            Intelligent Activity Monitoring & Focus Assistant
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-900">Version:</span>
            <span className="ml-2 text-gray-600">1.0.0</span>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-900 block mb-2">Features:</span>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Real-time activity monitoring</li>
              <li>AI-powered focus notifications</li>
              <li>Window and application tracking</li>
              <li>Idle detection and analysis</li>
              <li>Privacy-focused design</li>
            </ul>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-900 block mb-2">Privacy:</span>
            <p className="text-gray-600 text-sm leading-relaxed">
              All activity data is stored locally on your device. No data is transmitted to external servers 
              except when using the optional AI assistant feature with your own API key.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 