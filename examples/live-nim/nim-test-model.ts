/**
 * @file nim-test-model.ts — Test-only OpenAI-compatible model for v2/v3-only consumers.
 * @module examples/live-nim/nim-test-model
 *
 * Some consumers (notably VoltAgent's bundled AI SDK, which accepts only v2/v3
 * models) cannot drive the current `@ai-sdk/openai` provider (v4). This helper
 * builds the model on ai's own `MockLanguageModelV3` with a fetch-backed
 * `doGenerate`, so it type-checks against exactly the surface those consumers
 * accept. Test scaffolding only: production code should use a proper
 * provider package.
 */
import { MockLanguageModelV3 } from 'ai/test';

/** Options for {@link createNimTestModel}. */
export interface NimTestModelOptions {
  /** Chat-completions base URL. */
  readonly baseUrl: string;
  /** Bearer key for the endpoint. */
  readonly apiKey: string;
  /** Model id to request. */
  readonly modelId: string;
}

/** Extracted text from one prompt message. */
function messageText(message: {
  role: string;
  content: unknown;
}): string | null {
  if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') {
    return null;
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (!Array.isArray(message.content)) {
    return null;
  }
  const parts: string[] = [];
  for (const part of message.content) {
    if (typeof part !== 'object' || part === null) {
      continue;
    }
    const record = part as { type?: unknown; text?: unknown };
    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push(record.text);
    }
  }
  return parts.join(' ');
}

/**
 * Creates a fetch-backed mock model over an OpenAI-compatible endpoint.
 * @param options - Endpoint, key, and model id.
 * @returns A `MockLanguageModelV3` hitting the real endpoint.
 */
export function createNimTestModel(
  options: NimTestModelOptions
): MockLanguageModelV3 {
  const { baseUrl, apiKey, modelId } = options;
  return new MockLanguageModelV3({
    doGenerate: async (callOptions) => {
      const messages: Array<{ role: string; content: string }> = [];
      for (const message of callOptions.prompt) {
        const text = messageText({
          role: message.role,
          content: message.content,
        });
        if (text !== null) {
          messages.push({ role: message.role, content: text });
        }
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelId, messages }),
      });
      if (!response.ok) {
        throw new Error(`NIM chat failed with HTTP ${String(response.status)}`);
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = (body.choices ?? [])
        .map((choice) => choice.message?.content ?? '')
        .join('');
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}
