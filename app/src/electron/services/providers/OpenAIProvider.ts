import { LLMProvider, LLMResponse } from '../../../shared/types.js';

// NOTE: This is a template for future OpenAI integration
// To use: npm install openai

export class OpenAIProvider implements LLMProvider {
  public name = 'OpenAI';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // TODO: Initialize OpenAI client when implementing
    console.log('[OpenAIProvider] Initialized (template - not yet implemented)');
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    // TODO: Implement OpenAI API call
    console.log('[OpenAIProvider] generateResponse called (not yet implemented)');
    
    // Placeholder implementation
    throw new Error('OpenAI provider not yet implemented. Use Gemini or Mock provider instead.');
    
    /*
    // Future implementation example:
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150
      });
      
      const text = completion.choices[0]?.message?.content || '';
      return this.parseResponse(text);
    } catch (error) {
      console.error('[OpenAIProvider] Error:', error);
      throw error;
    }
    */
  }

  private parseResponse(text: string): LLMResponse {
    // TODO: Implement response parsing similar to GeminiProvider
    return {
      type: 'GET_FOCUS_BACK',
      should_notify: false,
      message: text,
      confidence: 0.5,
      reasoning: 'OpenAI provider response parsing not implemented'
    };
  }
} 