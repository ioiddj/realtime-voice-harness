/**
 * @file AudioClip.ts — In-memory PCM audio value object.
 * @module audio/AudioClip
 *
 * Immutable container for a single mono PCM audio segment exchanged between
 * the harness, the synthesizer, the transport, and the transcriber.
 */
export interface AudioClip {
  /** Mono PCM samples normalized to [-1, 1]. */
  readonly samples: Float32Array;
  /** Sample rate in Hz. */
  readonly sampleRate: number;
  /** Opaque tag used by test doubles to carry expected transcripts. */
  readonly tag?: string;
}

/** Default sample rate (Hz) used by test doubles. */
export const DEFAULT_SAMPLE_RATE: number = 16000;

/** Options for {@link concatClips}. */
export interface ConcatClipsOptions {
  /**
   * Tag carried onto the joined clip. Joined audio is otherwise untagged,
   * which makes tagged test doubles unresolvable — pass the first clip's
   * tag when joining chunks of one utterance.
   */
  readonly tag?: string;
}

/**
 * Concatenates clips that share a sample rate.
 * @param clips - Clips to join in order.
 * @param options - Optional tag carried onto the joined clip.
 * @returns A single clip with the joined samples.
 */
export function concatClips(
  clips: readonly AudioClip[],
  options?: ConcatClipsOptions
): AudioClip {
  if (clips.length === 0) {
    return { samples: new Float32Array(0), sampleRate: DEFAULT_SAMPLE_RATE };
  }
  const first = clips[0] as AudioClip;
  const sampleRate = first.sampleRate;
  let total = 0;
  for (const clip of clips) {
    total += clip.samples.length;
  }
  const joined = new Float32Array(total);
  let offset = 0;
  for (const clip of clips) {
    joined.set(clip.samples, offset);
    offset += clip.samples.length;
  }
  if (options?.tag === undefined) {
    return { samples: joined, sampleRate };
  }
  return { samples: joined, sampleRate, tag: options.tag };
}
