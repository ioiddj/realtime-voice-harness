/**
 * @file mlg-voice.test.ts — The real MLG voice: slower, bassier, airhorned.
 * @module tests/mlg-voice
 */
import { describe, expect, it } from 'vitest';
import { FakeSynthesizer, MlgVoice } from '../src/index.js';

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.abs(samples[i] as number);
    if (value > peak) {
      peak = value;
    }
  }
  return peak;
}

describe('MlgVoice', () => {
  it('rejects empty text and sub-1.0 slowdowns', async () => {
    const voice = new MlgVoice({ synthesizer: new FakeSynthesizer() });
    await expect(voice.synthesize('')).rejects.toThrow('non-empty');
    expect(() => new MlgVoice({ slowdown: 0.5 })).toThrow('slowdown');
  });

  it('slows down without changing the sample rate or clipping', async () => {
    const voice = new MlgVoice({
      synthesizer: new FakeSynthesizer(),
      airhorn: 'off',
    });
    const clip = await voice.synthesize('Hello there.');
    expect(clip.sampleRate).toBe(16000);
    // 12 chars at 1.22x slowdown, rounded down per output sample.
    expect(clip.samples.length).toBeGreaterThan(12);
    expect(peakOf(clip.samples)).toBeLessThanOrEqual(1);
    expect(peakOf(clip.samples)).toBeGreaterThan(0);
  });

  it('blasts the airhorn once by default, then never again', async () => {
    const voice = new MlgVoice({ synthesizer: new FakeSynthesizer() });
    const first = await voice.synthesize('Hello there.');
    const head = first.samples.slice(0, 1000);
    expect(peakOf(head)).toBeGreaterThan(0.9);
    const second = await voice.synthesize('Hello there.');
    expect(second.samples.length).toBeLessThan(first.samples.length);
    expect(second.samples.length).toBe(first.samples.length - Math.floor(16000 * 0.45));
  });

  it('preserves tags and stays deterministic', async () => {    const voice = new MlgVoice({
      synthesizer: new FakeSynthesizer('whisper'),
      airhorn: 'off',
    });
    const first = await voice.synthesize('Hello there.');
    const second = await voice.synthesize('Hello there.');
    expect(first.tag).toBe('say:whisper:Hello there.');
    expect(Array.from(first.samples)).toEqual(Array.from(second.samples));
  });

  it('plays a provided vintage blast instead of the synthesized one', async () => {
    const voice = new MlgVoice({
      synthesizer: new FakeSynthesizer(),
      airhorn: 'every',
      airhornSample: {
        samples: new Float32Array([0, 0.5, -0.5, 0.25]),
        sampleRate: 16000,
      },
    });
    const clip = await voice.synthesize('Hi');
    // Peak-normalized to 0.95: the third sample keeps its negative sign,
    // while the square-wave fallback would be positive there.
    expect(clip.samples[2] as number).toBeLessThan(0);
    expect(Math.abs(clip.samples[1] as number)).toBeCloseTo(0.95, 5);
  });

  it('skips silent vintage blasts instead of prepending nothing', async () => {
    const voice = new MlgVoice({
      synthesizer: new FakeSynthesizer('default'),
      airhorn: 'every',
      airhornSample: { samples: new Float32Array(4), sampleRate: 16000 },
    });
    const clip = await voice.synthesize('Hi');
    // Slowed 'Hi' (2 chars at 1.22x) with no blast prepended.
    expect(clip.samples.length).toBe(2);
  });
});
