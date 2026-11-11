/** @file voice-harness.test.ts — Voice harness loop example for bun:test. @module examples/bun/voice-harness */
/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

/**
 * Creates a harness wired to in-memory doubles.
 * @returns A harness answering 'Hello, human.' then 'Second reply.'.
 */
function createHarness(): VoiceConversationHarness {
  const synthesizer = new FakeSynthesizer();
  const transcriber = new FakeTranscriber();
  const transport = new ScriptedAppTransport(synthesizer, [
    'Hello, human.',
    'Second reply.',
  ]);
  return new VoiceConversationHarness({ synthesizer, transcriber, transport });
}

describe('VoiceConversationHarness (bun:test)', (): void => {
  it('speaks text and hears the app reply as text', async (): Promise<void> => {
    const harness: VoiceConversationHarness = createHarness();
    await harness.connect();
    try {
      const result = await harness.speak('Hello, agent.', {
        timeoutMs: 5_000,
      });
      expect(result.said).toBe('Hello, agent.');
      expect(result.heard).toBe('Hello, human.');
      expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
    } finally {
      await harness.disconnect();
    }
  });

  it('runs a scripted conversation with an async reply assertion', async (): Promise<void> => {
    const harness: VoiceConversationHarness = createHarness();
    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'Hello, agent.',
          expectReply: async (reply: string): Promise<void> => {
            expect(reply).toBe('Hello, human.');
          },
        },
        {
          say: 'Second line.',
          expectReply: async (reply: string): Promise<void> => {
            expect(reply).toBe('Second reply.');
          },
        },
      ]);
      expect(results).toHaveLength(2);
    } finally {
      await harness.disconnect();
    }
  });
});
