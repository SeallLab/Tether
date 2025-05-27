import { LLMProvider } from '../../../shared/types.js';
import { GeminiProvider } from './GeminiProvider.js';
import { MockProvider } from './MockProvider.js';

// Export all providers
export { GeminiProvider } from './GeminiProvider.js';
export { MockProvider } from './MockProvider.js';

// Provider types
export type ProviderType = 'gemini' | 'mock';

// Factory function to create providers
export function createProvider(type: ProviderType, config?: any): LLMProvider {
  switch (type) {
    case 'gemini':
      if (!config?.apiKey) {
        throw new Error('Gemini API key is required');
      }
      return new GeminiProvider(config.apiKey);
    
    case 'mock':
      return new MockProvider();
    
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// Helper function to create provider with fallback
export function createProviderWithFallback(preferredType: ProviderType, config?: any): LLMProvider {
  try {
    return createProvider(preferredType, config);
  } catch (error) {
    console.warn(`[ProviderFactory] Failed to create ${preferredType} provider, falling back to mock:`, error);
    return createProvider('mock');
  }
}

// Available providers info
export const AVAILABLE_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    requiresApiKey: true,
    description: 'Advanced AI model by Google'
  },
  mock: {
    name: 'Mock Provider',
    requiresApiKey: false,
    description: 'Simple rule-based responses for testing'
  }
} as const; 