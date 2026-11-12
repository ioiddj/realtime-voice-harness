/**
 * @file audio-clip.test.ts — PCM clip value objects: join and resample.
 * @module tests/audio-clip
 */
import { describe, expect, it } from 'vitest';
import {
  concatClips,
  resampleClip,
  type AudioClip,
} from '../src/index.js';

function clip(samples: number[], sampleRate: number, tag?: string): AudioClip {
  const result: AudioClip = {
    samples: new Float32Array(samples),
    sampleRate,
  };
  return tag === undefined ? result : { ...result, tag };
}

describe('resampleClip', () => {
  it('passes the clip through untouched at the same rate', () => {
    const original = clip([0, 1, 2], 16000, 'say:default:hi');
    expect(resampleClip(original, 16000)).toBe(original);
  });

  it('downsamples 2:1 and preserves the tag', () => {
    const down = resampleClip(clip([0, 1, 2, 3], 4, 'say:default:hi'), 2);
    expect(down.sampleRate).toBe(2);
    expect(Array.from(down.samples)).toEqual([0, 2]);
    expect(down.tag).toBe('say:default:hi');
  });

  it('upsamples with linear interpolation', () => {
    const up = resampleClip(clip([0, 2], 2), 4);
    expect(up.sampleRate).toBe(4);
    expect(Array.from(up.samples)).toEqual([0, 1, 2, 2]);
  });

  it('drops the tag only when there never was one', () => {
    expect(resampleClip(clip([0, 1], 2), 4).tag).toBeUndefined();
  });
});

describe('concatClips', () => {
  it('carries an explicit tag onto the joined clip', () => {
    const joined = concatClips(
      [clip([0], 16000), clip([1], 16000, 'say:default:hi')],
      { tag: 'say:default:hi' }
    );
    expect(Array.from(joined.samples)).toEqual([0, 1]);
    expect(joined.tag).toBe('say:default:hi');
  });
});
