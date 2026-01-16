import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../../config/index.js';
import type { Logger } from 'winston';

export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor(
    private config: Config,
    private logger?: Logger
  ) {
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
  }

  async complete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    const maxTokens = options?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? 0.7;

    this.logger?.debug('Sending request to Claude', { model: this.model, maxTokens, promptLength: prompt.length });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      this.logger?.debug('Received response from Claude', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      return textContent.text;
    } catch (error) {
      this.logger?.error('Claude API error', { error });
      throw error;
    }
  }

  async completeWithSystem(systemPrompt: string, userPrompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    const maxTokens = options?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? 0.7;

    this.logger?.debug('Sending request to Claude with system prompt', { model: this.model, maxTokens });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textContent.text;
    } catch (error) {
      this.logger?.error('Claude API error', { error });
      throw error;
    }
  }

  async parseJson<T>(prompt: string, options?: { maxTokens?: number }): Promise<T> {
    const response = await this.complete(prompt, { ...options, temperature: 0.3 });

    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
    const jsonStr = jsonMatch[1]?.trim() || response.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      this.logger?.error('Failed to parse JSON from Claude response', { response: jsonStr });
      throw new Error('Failed to parse JSON from Claude response');
    }
  }
}
