/**
 * @file latency.test.ts — Time-to-first-audio measurement and budget assertions.
 * @module tests/latency
 */
import { describe, expect, it } from 'vitest';
import {
  assertLatency,
  FakeSynthesizer,
  FakeTranscriber,
  VoiceConversationHarness,
  type AudioClip,
  type IRealtimeTransport,
  type TurnResult,
} from '../src/index.js';

function delayedTransport(delayMs: number): {
  transport: IRealtimeTransport;
  synthesizer: FakeSynthesizer;
} {
  const synthesizer = new FakeSynthesizer();
  let emit: ((audio: AudioClip) => void) | null = null;
  const transport: IRealtimeTransport = {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    sendAudio: () => {
      void (async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const reply = await synthesizer.synthesize('Slow hello.');
        queueMicrotask(() => {
          emit?.(reply);
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
  return { transport, synthesizer };
}

const silentTransport: IRealtimeTransport = {
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  sendAudio: () => Promise.resolve(),
  onAudio: () => {
    const unsubscribe = (): void => undefined;
    return unsubscribe;
  },
};

function heardResult(overrides: Partial<TurnResult> = {}): TurnResult {
  return {
    said: 'Hi.',
    heard: 'Ho.',
    roundTripMs: 120,
    outbound: { samples: new Float32Array(1), sampleRate: 16000 },
    reply: { samples: new Float32Array(1), sampleRate: 16000 },
    timeToFirstAudioMs: 100,
    ...overrides,
  };
}

describe('turn latency', () => {
  it('measures time to first audio within the round trip', async () => {
    const { transport, synthesizer } = delayedTransport(150);
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport,
    });
    await harness.connect();
    try {
      const result = await harness.speak('Hello?', { timeoutMs: 5_000 });
      expect(result.heard).toBe('Slow hello.');
      expect(result.timeToFirstAudioMs).not.toBeNull();
      const first = result.timeToFirstAudioMs as number;
      expect(first).toBeGreaterThanOrEqual(100);
      expect(first).toBeLessThanOrEqual(result.roundTripMs);
    } finally {
      await harness.disconnect();
    }
  });

  it('reports null first audio on silence', async () => {
    const harness = new VoiceConversationHarness({
      synthesizer: new FakeSynthesizer(),
      transcriber: new FakeTranscriber(),
      transport: silentTransport,
    });
    await harness.connect();
    try {
      const result = await harness.speak('Hello?', { timeoutMs: 200 });
      expect(result.timeToFirstAudioMs).toBeNull();
      expect(result.reply).toBeNull();
    } finally {
      await harness.disconnect();
    }
  });
});

describe('assertLatency', () => {
  it('passes a turn inside budget', () => {
    expect(() => {
      assertLatency(heardResult(), {
        timeToFirstAudioMs: 100,
        roundTripMs: 120,
      });
    }).not.toThrow();
  });

  it('throws naming the blown first-audio bound', () => {
    expect(() => {
      assertLatency(heardResult({ timeToFirstAudioMs: 500 }), {
        timeToFirstAudioMs: 100,
      });
    }).toThrow(/timeToFirstAudioMs=500 exceeds budget 100ms/);
  });

  it('throws on silent turns when first audio is budgeted', () => {
    expect(() => {
      assertLatency(heardResult({ timeToFirstAudioMs: null, heard: '' }), {
        timeToFirstAudioMs: 100,
      });
    }).toThrow(/timeToFirstAudioMs=null/);
  });

  it('throws naming the blown round-trip bound', () => {
    expect(() => {
      assertLatency(heardResult({ roundTripMs: 900 }), { roundTripMs: 120 });
    }).toThrow(/roundTripMs=900 exceeds budget 120ms/);
  });
});
