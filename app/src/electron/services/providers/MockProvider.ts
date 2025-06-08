import { LLMProvider, LLMResponse } from '../../../shared/types.js';

export class MockProvider implements LLMProvider {
  public name = 'Mock';

  async generateChatResponse(prompt: string): Promise<string> {
    console.log('[MockProvider] Mock chat response generated for prompt length:', prompt.length);
    
    // Simple ADHD-focused responses based on keywords
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('focus') || lowerPrompt.includes('distracted')) {
      return "I understand focus can be challenging with ADHD. Try the 2-minute rule: if something takes less than 2 minutes, do it now. For bigger tasks, set a 15-minute timer and just start. 🎯";
    }
    
    if (lowerPrompt.includes('overwhelmed') || lowerPrompt.includes('too much')) {
      return "Feeling overwhelmed is totally normal with ADHD. Let's break this down: what's the ONE most important thing you need to do today? We can tackle the rest step by step. 💪";
    }
    
    if (lowerPrompt.includes('procrastinating') || lowerPrompt.includes('putting off')) {
      return "Procrastination often comes from perfectionism or task overwhelm. Try the 'Swiss cheese' method: poke holes in the task by doing small, random parts. Progress is progress! 🧀";
    }
    
    if (lowerPrompt.includes('plan') || lowerPrompt.includes('schedule')) {
      return "Great thinking ahead! For ADHD brains, visual planning works best. Try time-blocking with buffers between tasks, and remember to schedule breaks too. What's your top priority? 📅";
    }
    
    return "I hear you! ADHD can make things challenging, but you've got this. What specific area would you like help with - focus, planning, or breaking down a task? 💙";
  }

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