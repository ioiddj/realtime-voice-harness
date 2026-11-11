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
  type AudioClip,
  type IRealtimeTransport,
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

  it('throws on silence with onTimeout throw and stays empty by default', async () => {
    const silent: IRealtimeTransport = {
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      sendAudio: () => Promise.resolve(),
      onAudio: () => {
        const unsubscribe = (): void => undefined;
        return unsubscribe;
      },
    };
    const harness = new VoiceConversationHarness({
      synthesizer: new FakeSynthesizer(),
      transcriber: new FakeTranscriber(),
      transport: silent,
    });
    await harness.connect();
    try {
      const quiet = await harness.speak('Hello?', { timeoutMs: 100 });
      expect(quiet.heard).toBe('');
      expect(quiet.reply).toBeNull();
      await expect(
        harness.speak('Hello?', { timeoutMs: 100, onTimeout: 'throw' })
      ).rejects.toThrow('no reply within 100ms');
    } finally {
      await harness.disconnect();
    }
  });

  it('transcribes chunked replies that arrive as multiple segments', async () => {
    const synthesizer = new FakeSynthesizer();
    let emit: ((audio: AudioClip) => void) | null = null;
    const transport: IRealtimeTransport = {
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      sendAudio: (_audio: AudioClip) => {
        void (async () => {
          // One utterance, two chunks, both tagged with the full reply text.
          const first = await synthesizer.synthesize('Hello, human.');
          const second = await synthesizer.synthesize('Hello, human.');
          queueMicrotask(() => {
            emit?.({ ...first, samples: first.samples.slice(0, 6) });
            emit?.({ ...second, samples: second.samples.slice(6) });
          });
        })();
        return Promise.resolve();
      },
      onAudio: (listener: (audio: AudioClip) => void) => {
        emit = listener;
        return () => {
          emit = null;
        };
      },
    };
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport,
    });

    await harness.connect();
    try {
      const result = await harness.speak('Hello, agent.', {
        timeoutMs: 5_000,
      });
      expect(result.heard).toBe('Hello, human.');
    } finally {
      await harness.disconnect();
    }
  });

  it('fails loudly when no replies are scripted', async () => {
    const synthesizer = new FakeSynthesizer();
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

  it('restarts scripted replies after reset for reuse across tests', async () => {
    const synthesizer = new FakeSynthesizer();
    const transport = new ScriptedAppTransport(synthesizer, ['One.', 'Two.']);
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport,
    });
    await harness.connect();
    try {
      const first = await harness.speak('a', { timeoutMs: 5_000 });
      const second = await harness.speak('b', { timeoutMs: 5_000 });
      expect(first.heard).toBe('One.');
      expect(second.heard).toBe('Two.');
      transport.reset();
      const again = await harness.speak('c', { timeoutMs: 5_000 });
      expect(again.heard).toBe('One.');
    } finally {
      await harness.disconnect();
    }
  });
});
