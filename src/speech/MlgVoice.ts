/**
 * @file MlgVoice.ts — The infamous MLG voiceover voice, for real.
 * @module speech/MlgVoice
 *
 * A real, audible MLG voice: wraps any speech synthesizer and runs its
 * output through the meme chain — pitched-down slowdown for the
 * movie-trailer depth, bass boost plus soft clipping for the body, and an
 * optional airhorn blast before the line. Deterministic given the same
 * inner synthesizer: same text always renders the same clip.
 */
import { resampleClip, type AudioClip } from '../audio/AudioClip.js';
import type { ISpeechSynthesizer } from './ISpeechSynthesizer.js';
import { TransformersTtsAdapter } from './local/TransformersTtsAdapter.js';

/** When the airhorn fires. */
export type MlgAirhorn = 'off' | 'first' | 'every';

/** Options for {@link MlgVoice}. */
export interface MlgVoiceOptions {
  /**
   * Inner synthesizer rendering the raw line. Defaults to local Supertonic
   * TTS (no keys, downloads once).
   */
  readonly synthesizer?: ISpeechSynthesizer;
  /**
   * Slowdown factor applied to the line (> 1 is deeper and slower).
   * Defaults to 1.22 (about three semitones down, trailer-grade).
   */
  readonly slowdown?: number;
  /** Bass boost applied before soft clipping. Defaults to 1.6. */
  readonly bassBoost?: number;
  /**
   * Airhorn policy. Defaults to `'first'` (blast once per voice, then
   * pure depth — a blast on every turn deafens speech recognition).
   */
  readonly airhorn?: MlgAirhorn;
}

/** Airhorn blast length in seconds. */
const AIRHORN_SECONDS: number = 0.45;

/** One-pole lowpass cutoff for the bass band, in Hz. */
const BASS_CUTOFF_HZ: number = 180;

/**
 * The MLG voiceover voice: deep, bassy, and punctual with airhorns.
 * Implements {@link ISpeechSynthesizer}, so it drops into any harness,
 * transport, or app voice slot.
 */
export class MlgVoice implements ISpeechSynthesizer {
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly slowdown: number;
  private readonly bassBoost: number;
  private readonly airhorn: MlgAirhorn;
  private aired = false;

  /**
   * Creates the MLG voice over an inner synthesizer.
   * @param options - Inner voice, slowdown, bass, and airhorn policy.
   */
  public constructor(options: MlgVoiceOptions = {}) {
    if (options.slowdown !== undefined && options.slowdown < 1) {
      throw new Error('MlgVoice slowdown must be >= 1.');
    }
    this.synthesizer = options.synthesizer ?? new TransformersTtsAdapter();
    this.slowdown = options.slowdown ?? 1.22;
    this.bassBoost = options.bassBoost ?? 1.6;
    this.airhorn = options.airhorn ?? 'first';
  }

  /**
   * Renders text in the MLG voice: slowed, bass-boosted, soft-clipped,
   * with an airhorn blast per the configured policy.
   * @param text - Line to deliver. Must be non-empty.
   * @returns PCM audio at the inner synthesizer's sample rate.
   */
  public async synthesize(text: string): Promise<AudioClip> {
    if (text.length === 0) {
      throw new Error('MlgVoice requires non-empty text.');
    }
    const raw = await this.synthesizer.synthesize(text);
    const deep = this.slowDown(raw);
    const beefy = this.boostBass(deep);
    if (!this.shouldAirhorn()) {
      return beefy;
    }
    this.aired = true;
    return {
      samples: this.concatBlast(beefy),
      sampleRate: beefy.sampleRate,
      ...(beefy.tag === undefined ? {} : { tag: beefy.tag }),
    };
  }

  private slowDown(clip: AudioClip): AudioClip {
    if (this.slowdown === 1) {
      return clip;
    }
    // Stretch at a higher rate, then relabel: same rate, slower + deeper.
    const stretched = resampleClip(clip, clip.sampleRate * this.slowdown);
    const slowed: AudioClip = {
      samples: stretched.samples,
      sampleRate: clip.sampleRate,
    };
    return clip.tag === undefined ? slowed : { ...slowed, tag: clip.tag };
  }

  private boostBass(clip: AudioClip): AudioClip {
    const alpha =
      1 / (1 + clip.sampleRate / (2 * Math.PI * BASS_CUTOFF_HZ));
    const out = new Float32Array(clip.samples.length);
    let lows = 0;
    for (let i = 0; i < clip.samples.length; i++) {
      const sample = clip.samples[i] as number;
      lows += alpha * (sample - lows);
      out[i] = Math.tanh(sample * 1.1 + lows * this.bassBoost);
    }
    const beefy: AudioClip = { samples: out, sampleRate: clip.sampleRate };
    return clip.tag === undefined ? beefy : { ...beefy, tag: clip.tag };
  }

  private shouldAirhorn(): boolean {
    if (this.airhorn === 'every') {
      return true;
    }
    if (this.airhorn === 'first' && !this.aired) {
      return true;
    }
    return false;
  }

  private concatBlast(clip: AudioClip): Float32Array {
    const blastLength = Math.floor(clip.sampleRate * AIRHORN_SECONDS);
    const joined = new Float32Array(blastLength + clip.samples.length);
    for (let i = 0; i < blastLength; i++) {
      const t = i / clip.sampleRate;
      const chord =
        Math.sign(Math.sin(2 * Math.PI * 440 * t)) * 0.5 +
        Math.sign(Math.sin(2 * Math.PI * 466 * t)) * 0.5;
      const decay = 1 - (i / blastLength) * 0.3;
      joined[i] = Math.max(-0.95, Math.min(0.95, chord * decay));
    }
    joined.set(clip.samples, blastLength);
    return joined;
  }
}
