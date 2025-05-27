import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMResponse } from '../../../shared/types.js';

export class GeminiProvider implements LLMProvider {
  public name = 'Gemini';
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the response to extract structured data
      return this.parseResponse(text);
    } catch (error) {
      console.error('[GeminiProvider] Error generating response:', error);
      throw error;
    }
  }

  private parseResponse(text: string): LLMResponse {
    try {
      // Try to parse JSON response first
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: 'GET_FOCUS_BACK',
          should_notify: parsed.should_notify || false,
          message: parsed.message || text,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      }
    } catch (error) {
      console.warn('[GeminiProvider] Failed to parse JSON response, using fallback');
    }

    // Fallback: try to extract information from plain text
    const shouldNotify = text.toLowerCase().includes('yes') || text.toLowerCase().includes('notify');
    const confidence = shouldNotify ? 0.7 : 0.3;
    
    return {
      type: 'GET_FOCUS_BACK',
      should_notify: shouldNotify,
      message: text,
      confidence,
      reasoning: 'Parsed from plain text response'
    };
  }
} 