/**
 * @file voice-harness.test.ts — Voice harness loop over a real VoltAgent agent.
 * @module examples/voltagent/voice-harness
 *
 * A real `Agent` (mock AI SDK model, no network) driven through
 * `voltAgentInvoke` + `LangChainTransport`: proves the documented one-liner
 * composes with the actual framework class, not just its shape.
 * `maxRetries: 0` keeps the suite deterministic (no backoff on failure).
 */
import { MockLanguageModelV3 } from 'ai/test';
import { Agent } from '@voltagent/core';
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  LangChainTransport,
  VoiceConversationHarness,
  voltAgentInvoke,
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
    instructions: 'Repeat the test reply.',
    model: mock,
    maxRetries: 0,
  });
  const synthesizer = new FakeSynthesizer();
  const transport = new LangChainTransport({
    invoke: voltAgentInvoke(agent),
    transcriber: new FakeTranscriber(),
    synthesizer,
  });
  return new VoiceConversationHarness({
    synthesizer,
    transcriber: new FakeTranscriber(),
    transport,
  });
}

describe('VoltAgent voice loop', () => {
  it('speaks text and hears the VoltAgent reply as text', async () => {
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

  it('runs a scripted conversation through the VoltAgent agent', async () => {
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
