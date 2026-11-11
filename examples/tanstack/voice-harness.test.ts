/**
 * @file voice-harness.test.ts — Voice harness loop over TanStack realtime.
 * @module examples/tanstack/voice-harness
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeToken,
  FakeSynthesizer,
  FakeTanStackAdapter,
  FakeTranscriber,
  TanStackTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

describe('TanStack realtime voice loop', () => {
  it('speaks text and hears the adapter reply as text', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new TanStackTransport({
      adapter: new FakeTanStackAdapter(['Hello, human.']),
      getToken: () => Promise.resolve(createFakeToken()),
      transcriber,
      synthesizer,
    });
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

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

  it('runs a scripted conversation with async reply assertions', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new TanStackTransport({
      adapter: new FakeTanStackAdapter(['First reply.', 'Second reply.']),
      getToken: () => Promise.resolve(createFakeToken()),
      transcriber,
      synthesizer,
    });
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'First line.',
          expectReply: (reply) =>
            new Promise<void>((resolve, reject) => {
              if (reply === 'First reply.') {
                resolve();
              } else {
                reject(new Error(`unexpected reply: ${reply}`));
              }
            }),
        },
        {
          say: 'Second line.',
          expectReply: (reply) => {
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
