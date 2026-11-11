/**
 * @file harness.test.ts — End-to-end loop: text in, scripted app, text out.
 * @module tests/harness
 */
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from '../src/index.js';

describe('VoiceConversationHarness', () => {
  it('speaks text and hears the app reply as text', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new ScriptedAppTransport(synthesizer, [
      'Hello, human.',
    ]);
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

  it('runs a scripted conversation with per-turn assertions', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new ScriptedAppTransport(synthesizer, [
      'First reply.',
      'Second reply.',
    ]);
    const harness = new VoiceConversationHarness<string>({ synthesizer, transcriber, transport }, 'session-1');

    expect(harness.getSession()).toBe('session-1');

    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'First line.',
          expectReply: (reply) => {
            expect(reply).toBe('First reply.');
          },
        },
        {
          say: 'Second line.',
          expectReply: (reply) => {
            expect(reply).toBe('Second reply.');
          },
        },
      ]);
      expect(results).toHaveLength(2);
      const second = results[1] as (typeof results)[number];
      expect(second.heard).toBe('Second reply.');
    } finally {
      await harness.disconnect();
    }
  });

  it('supports async reply assertions (async framework matchers)', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new ScriptedAppTransport(synthesizer, [
      'Async hello.',
    ]);
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'Hi.',
          expectReply: (reply) =>
            new Promise<void>((resolve, reject) => {
              if (reply === 'Async hello.') {
                resolve();
              } else {
                reject(new Error(`unexpected reply: ${reply}`));
              }
            }),
        },
      ]);
      expect(results).toHaveLength(1);
    } finally {
      await harness.disconnect();
    }
  });

  it('fails loudly when no replies are scripted', async () => {    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new ScriptedAppTransport(synthesizer, []);
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

    await harness.connect();
    try {
      await expect(
        harness.speak('Hello?', { timeoutMs: 500 })
      ).rejects.toThrow('no scripted replies');
    } finally {
      await harness.disconnect();
    }
  });
});
