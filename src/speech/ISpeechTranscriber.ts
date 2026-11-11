/**
 * @file ISpeechTranscriber.ts — Speech-to-text driver contract.
 * @module speech/ISpeechTranscriber
 *
 * Implemented by real STT adapters and by in-memory test doubles. The
 * harness only depends on this interface, never on a concrete engine.
 */
import type { AudioClip } from '../audio/AudioClip.js';

/** Result of transcribing one audio segment. */
export interface TranscriptionResult {
  /** Recognized text (may be empty when nothing was detected). */
  readonly text: string;
  /** Optional confidence in [0, 1] when the engine reports one. */
  readonly confidence?: number;
}

/** Speech-to-text driver contract. */
export interface ISpeechTranscriber {
  /**
   * Transcribes spoken audio to text.
   * @param audio - Audio segment to recognize.
   * @returns The recognition result.
   */
  transcribe(audio: AudioClip): Promise<TranscriptionResult>;
}
