/**
 * @file voice-harness.test.ts — Voice harness loop over a real Mastra agent.
 * @module examples/mastra/voice-harness
 *
 * A real `Agent` (mock AI SDK model, no network) driven through
 * `mastraInvoke` + `LangChainTransport`: proves the documented one-liner
 * composes with the actual framework class, not just its shape.
 */
import { MockLanguageModelV3 } from 'ai/test';
import { Agent } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  LangChainTransport,
  mastraInvoke,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

function createHarness(replyText: string): VoiceConversationHarness {
  const mock = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: 'text', text: replyText }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }),
  });
  const agent = new Agent({
    name: 'echo',
    id: 'echo-agent',
    instructions: 'Repeat the test reply.',
    model: mock,
  });
  const synthesizer = new FakeSynthesizer();
  const transport = new LangChainTransport({
    invoke: mastraInvoke(agent),
    transcriber: new FakeTranscriber(),
    synthesizer,
  });
  return new VoiceConversationHarness({
    synthesizer,
    transcriber: new FakeTranscriber(),
    transport,
  });
}

describe('Mastra voice loop', () => {
  it('speaks text and hears the Mastra agent reply as text', async () => {
    const harness = createHarness('Hello, human.');
    await harness.connect();
    try {
      const result = await harness.speak('Hello, agent.', {
        timeoutMs: 30_000,
      });
      expect(result.said).toBe('Hello, agent.');
      expect(result.heard).toBe('Hello, human.');
    } finally {
      await harness.disconnect();
    }
  });

  it('runs a scripted conversation through the Mastra agent', async () => {
    const harness = createHarness('Scripted reply.');
    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'First line.',
          expectReply: (reply) => {
            expect(reply).toBe('Scripted reply.');
          },
        },
      ]);
      expect(results).toHaveLength(1);
    } finally {
      await harness.disconnect();
    }
  });
});
