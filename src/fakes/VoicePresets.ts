/**
 * @file VoicePresets.ts — Selectable synthetic voices for the fake doubles.
 * @module fakes/VoicePresets
 *
 * Each voice is a deterministic PCM signature over the same text, so tests
 * can distinguish *who* spoke while the transcriber still resolves *what*
 * was said. Voices affect samples and tags only; the transcript is unchanged.
 */

/** Names of the built-in synthetic voices, in menu order. */
export const VOICE_NAMES = ['default', 'mlg', 'robot', 'whisper'] as const;

/** A selectable synthetic voice for the fake doubles. */
export type FakeVoiceName = (typeof VOICE_NAMES)[number];

/**
 * Narrows an unknown string to a known voice name.
 * @param value - Candidate voice name.
 * @returns True when the value names a built-in voice.
 */
export function isFakeVoiceName(value: string): value is FakeVoiceName {
  return (VOICE_NAMES as readonly string[]).includes(value);
}

/** Base sample for one character (the legacy default voice). */
function baseSample(text: string, index: number): number {
  return (text.charCodeAt(index) % 256) / 255 - 0.5;
}

/**
 * Renders the infamous MLG voiceover voice: an 8-sample airhorn blast
 * followed by a bass-boosted, hard-clipped body with a slow wobble.
 * Oh baby a triple.
 * @param text - Utterance to render. Must be non-empty.
 * @returns PCM samples for the MLG voice.
 */
function renderMlg(text: string): Float32Array {
  const blast = 8;
  const samples = new Float32Array(blast + text.length);
  for (let i = 0; i < blast; i++) {
    samples[i] = i % 2 === 0 ? 0.95 : -0.95;
  }
  for (let i = 0; i < text.length; i++) {
    const boosted = baseSample(text, i) * 2.5;
    const clipped = Math.max(-0.9, Math.min(0.9, boosted));
    samples[blast + i] = clipped * (0.6 + 0.4 * Math.sin(i * 0.9));
  }
  return samples;
}

/**
 * Renders deterministic PCM samples for one voice.
 * @param text - Utterance to render. Must be non-empty.
 * @param voice - Voice signature to apply.
 * @returns PCM samples at the harness default sample rate.
 */
export function renderVoiceSamples(
  text: string,
  voice: FakeVoiceName
): Float32Array {
  if (voice === 'mlg') {
    return renderMlg(text);
  }
  const samples = new Float32Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const base = baseSample(text, i);
    if (voice === 'robot') {
      samples[i] = Math.round(base * 2) / 2;
    } else if (voice === 'whisper') {
      samples[i] = base * 0.15 + ((i * 37) % 11) / 11 * 0.05 - 0.025;
    } else {
      samples[i] = base;
    }
  }
  return samples;
}
