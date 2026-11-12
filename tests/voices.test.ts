/**
 * @file voices.test.ts — Selectable fake voices: distinct samples, same text.
 * @module tests/voices
 */
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  isFakeVoiceName,
  ScriptedAppTransport,
  VOICE_NAMES,
  VoiceConversationHarness,
} from '../src/index.js';

function samplesEqual(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

describe('selectable voices', () => {
  it('exposes the voice menu with the MLG voiceover voice', () => {
    expect(VOICE_NAMES).toContain('mlg');
    expect(isFakeVoiceName('mlg')).toBe(true);
    expect(isFakeVoiceName('morgan-freeman')).toBe(false);
  });

  it('defaults to the MLG voice and tags clips with voice and text', async () => {
    const synth = new FakeSynthesizer();
    expect(synth.getVoice()).toBe('mlg');
    const clip = await synth.synthesize('Hi');
    expect(clip.tag).toBe('say:mlg:Hi');
  });

  it('resolves the same transcript in every voice', async () => {
    const transcriber = new FakeTranscriber();
    for (const voice of VOICE_NAMES) {
      const clip = await new FakeSynthesizer(voice).synthesize('Hello?');
      expect(clip.tag).toBe(`say:${voice}:Hello?`);
      const result = await transcriber.transcribe(clip);
      expect(result.text).toBe('Hello?');
      expect(result.confidence).toBe(1);
    }
  });

  it('renders distinct samples per voice', async () => {
    const seen: Float32Array[] = [];
    for (const voice of VOICE_NAMES) {
      const clip = await new FakeSynthesizer(voice).synthesize(
        'The quick brown fox.'
      );
      for (const previous of seen) {
        expect(samplesEqual(previous, clip.samples)).toBe(false);
      }
      seen.push(clip.samples);
    }
  });

  it('renders the MLG voice with an airhorn blast and clipped body', async () => {
    const first = await new FakeSynthesizer('mlg').synthesize('Triple!');
    const second = await new FakeSynthesizer('mlg').synthesize('Triple!');
    expect(samplesEqual(first.samples, second.samples)).toBe(true);
    for (let i = 0; i < 8; i++) {
      expect(first.samples[i]).toBeCloseTo(i % 2 === 0 ? 0.95 : -0.95, 5);
    }
    for (let i = 8; i < first.samples.length; i++) {
      expect(Math.abs(first.samples[i] as number)).toBeLessThanOrEqual(0.9);
    }
  });

  it('keeps backward compatibility with pre-voice tags', async () => {
    const transcriber = new FakeTranscriber();
    const legacy = await transcriber.transcribe({
      samples: new Float32Array(0),
      sampleRate: 16000,
      tag: 'say:Hello',
    });
    expect(legacy.text).toBe('Hello');
    const colons = await new FakeSynthesizer('mlg').synthesize('a:b');
    expect(colons.tag).toBe('say:mlg:a:b');
    expect((await transcriber.transcribe(colons)).text).toBe('a:b');
  });

  it('drives a full harness loop in the MLG voice', async () => {
    const synthesizer = new FakeSynthesizer('mlg');
    expect(synthesizer.getVoice()).toBe('mlg');
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new ScriptedAppTransport(synthesizer, ['Wombo combo.']),
    });
    await harness.connect();
    try {
      const turn = await harness.speak('That ain\'t Falco.', {
        timeoutMs: 5_000,
      });
      expect(turn.heard).toBe('Wombo combo.');
    } finally {
      await harness.disconnect();
    }
  });
});
