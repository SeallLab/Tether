import React from 'react';

export function LoadingScreen() {
  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Tether Settings
        </h1>
      </div>

      {/* Loading Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="p-12 bg-white rounded-xl shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-medium text-gray-700 mb-2">
            Loading Settings...
          </h2>
          
          <p className="text-gray-600 leading-relaxed">
            Fetching current configuration from activity monitoring service.
          </p>
        </div>
      </div>
    </div>
  );
} 