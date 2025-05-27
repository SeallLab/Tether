import { LLMProvider, LLMResponse } from '../../../shared/types.js';

export class MockProvider implements LLMProvider {
  public name = 'Mock';

  async generateResponse(prompt: string): Promise<LLMResponse> {
    console.log('[MockProvider] Mock response generated for prompt length:', prompt.length);
    
    // Simple logic for mock responses
    const idleDurationMatch = prompt.match(/idle for (\d+) seconds/);
    const idleDuration = idleDurationMatch ? parseInt(idleDurationMatch[1]) : 0;
    
    const shouldNotify = idleDuration > 300; // Notify if idle > 5 minutes
    const confidence = shouldNotify ? 0.8 : 0.3;
    
    let message = "Welcome back! Ready to focus?";
    
    if (idleDuration > 1800) { // 30+ minutes
      message = "Long break! Let's get back to crushing those goals! 🚀";
    } else if (idleDuration > 900) { // 15+ minutes
      message = "Time to dive back in! You've got this! 💪";
    } else if (idleDuration > 300) { // 5+ minutes
      message = "Quick break's over! Back to productive work! ⚡";
    }

    return {
      type: 'GET_FOCUS_BACK',
      should_notify: shouldNotify,
      message: message,
      confidence: confidence,
      reasoning: `Mock provider: ${shouldNotify ? 'Long idle period detected' : 'Short break is normal'}`
    };
  }
} 