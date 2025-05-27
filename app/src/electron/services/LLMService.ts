import { LLMProvider, LLMResponse, ActivityLog } from '../../shared/types.js';
import { ActivityLogger } from './ActivityLogger.js';
import { createProviderWithFallback, ProviderType } from './providers/index.js';

export class LLMService {
  private provider: LLMProvider;
  private activityLogger: ActivityLogger;

  constructor(provider: LLMProvider, activityLogger: ActivityLogger) {
    this.provider = provider;
    this.activityLogger = activityLogger;
  }

  async analyzeFocusLoss(idleDuration: number, recentLogs: ActivityLog[]): Promise<LLMResponse> {
    const prompt = this.createFocusAnalysisPrompt(idleDuration, recentLogs);
    
    try {
      console.log('[LLMService] Analyzing focus loss with', this.provider.name);
      const response = await this.provider.generateResponse(prompt);
      console.log('[LLMService] Response:', response);
      return response;
    } catch (error) {
      console.error('[LLMService] Error analyzing focus loss:', error);
      
      // If using Gemini and it fails, suggest switching to mock
      if (this.provider.name === 'Gemini') {
        console.warn('[LLMService] Gemini provider failed. Consider checking your API key or using mock provider.');
      }
      
      // Fallback response
      const fallbackMessage = idleDuration > 1800 
        ? "Long break detected! Ready to refocus and tackle your goals? 🚀"
        : idleDuration > 900 
        ? "Welcome back! Time to dive into productive work 💪"
        : "Quick break's over! Let's get back to work ⚡";
      
      return {
        type: 'GET_FOCUS_BACK',
        should_notify: idleDuration > 300, // Only notify for breaks > 5 minutes
        message: fallbackMessage,
        confidence: 0.5,
        reasoning: `Fallback due to ${this.provider.name} provider error`
      };
    }
  }

  private createFocusAnalysisPrompt(idleDuration: number, recentLogs: ActivityLog[]): string {
    const recentWindows = this.extractRecentWindows(recentLogs);
    const sessionContext = this.analyzeSessionContext(recentLogs);
    
    return `You are an AI productivity assistant that helps users maintain focus. 

CONTEXT:
- User has been idle for ${Math.round(idleDuration)} seconds (${Math.round(idleDuration / 60)} minutes)
- This is their recent activity before going idle:

RECENT WINDOWS/APPLICATIONS:
${recentWindows.map(w => `- ${w.application_name}: ${w.window_title}`).join('\n')}

SESSION ANALYSIS:
- Total session time: ${Math.round(sessionContext.sessionDuration / 60)} minutes
- Window changes: ${sessionContext.windowChanges}
- Most used app: ${sessionContext.mostUsedApp}

PURPOSE: 
Analyze if this idle period represents a legitimate focus loss (not just a natural break) and if the user should be gently reminded to get back on track.

RESPOND WITH VALID JSON:
{
  "should_notify": boolean,
  "message": "Personalized, encouraging message to help them refocus (max 100 chars)",
  "confidence": number (0-1),
  "reasoning": "Brief explanation of your decision"
}

Consider:
- Short breaks (under 5 minutes) are normal
- Longer idle periods during work hours may indicate distraction
- Tailor the message to what they were working on
- Be encouraging, not judgmental
- If they were switching between many apps, they might be distracted`;
  }

  private extractRecentWindows(logs: ActivityLog[]): any[] {
    return logs
      .filter(log => log.type === 'window_change')
      .slice(-5) // Last 5 window changes
      .map(log => log.data);
  }

  private analyzeSessionContext(logs: ActivityLog[]): any {
    const sessionStart = Math.min(...logs.map(log => log.timestamp));
    const sessionEnd = Math.max(...logs.map(log => log.timestamp));
    const sessionDuration = sessionEnd - sessionStart;
    
    const windowChanges = logs.filter(log => log.type === 'window_change').length;
    
    const appCounts: { [key: string]: number } = {};
    logs
      .filter(log => log.type === 'window_change')
      .forEach(log => {
        const appName = (log.data as any).application_name;
        appCounts[appName] = (appCounts[appName] || 0) + 1;
      });
    
    const mostUsedApp = Object.keys(appCounts).reduce((a, b) => 
      appCounts[a] > appCounts[b] ? a : b, Object.keys(appCounts)[0] || 'Unknown'
    );

    return {
      sessionDuration,
      windowChanges,
      mostUsedApp
    };
  }

  // Method to switch providers dynamically
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
    console.log(`[LLMService] Switched to provider: ${provider.name}`);
  }

  getCurrentProvider(): string {
    return this.provider.name;
  }

  getActivityLogger(): ActivityLogger {
    return this.activityLogger;
  }
}

// Factory function to create LLM service
export function createLLMService(
  activityLogger: ActivityLogger, 
  providerType: ProviderType = 'mock',
  config?: any
): LLMService {
  const provider = createProviderWithFallback(providerType, config);
  return new LLMService(provider, activityLogger);
} 