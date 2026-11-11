/**
 * @file voice-harness.test.ts — Full loop on real local speech (no keys).
 * @module examples/local-speech/voice-harness
 *
 * Supertonic TTS renders every utterance and Whisper transcribes every reply,
 * all in-process via transformers.js. First run downloads the models
 * (~450MB total, cached afterwards); generous timeouts cover that.
 */
import { describe, expect, it } from 'vitest';
import {
  TransformersSttAdapter,
  TransformersTtsAdapter,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

const LIVE_TIMEOUT_MS: number = 600_000;

function maxAbs(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.abs(samples[i] as number);
    if (value > peak) {
      peak = value;
    }
  }
  return peak;
}

describe('local speech loop (transformers.js, no keys)', () => {
  it(
    'synthesizes audible speech with Supertonic',
    async () => {
      const tts = new TransformersTtsAdapter();
      const clip = await tts.synthesize(
        'Hello, this is a local voice test.'
      );
      expect(clip.sampleRate).toBeGreaterThan(0);
      expect(clip.samples.length).toBeGreaterThan(1000);
      expect(maxAbs(clip.samples)).toBeGreaterThan(0.01);
    },
    LIVE_TIMEOUT_MS
  );

  it(
    'transcribes Supertonic speech back to text with Whisper',
    async () => {
      const tts = new TransformersTtsAdapter();
      const stt = new TransformersSttAdapter();
      const said = 'Hello, this is a test of the local speech pipeline.';
      const clip = await tts.synthesize(said);
      const result = await stt.transcribe(clip);
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
    },
    LIVE_TIMEOUT_MS
  );

  it(
    'runs a harness turn end to end on real audio',
    async () => {
      const synthesizer = new TransformersTtsAdapter();
      const transcriber = new TransformersSttAdapter();
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
        const turn = await harness.speak('Hello, agent.', {
          timeoutMs: 120_000,
        });
        expect(typeof turn.heard).toBe('string');
        expect(turn.heard.length).toBeGreaterThan(0);
        expect(turn.timeToFirstAudioMs).not.toBeNull();
      } finally {
        await harness.disconnect();
      }
    },
    LIVE_TIMEOUT_MS
  );
});
