/**
 * @file ISpeechSynthesizer.ts — Text-to-speech driver contract.
 * @module speech/ISpeechSynthesizer
 *
 * Implemented by real TTS adapters and by in-memory test doubles. The
 * harness only depends on this interface, never on a concrete engine.
 */
import type { AudioClip } from '../audio/AudioClip.js';

/** Text-to-speech driver contract. */
export interface ISpeechSynthesizer {
  /**
   * Synthesizes speech for the given text.
   * @param text - Utterance to speak. Must be non-empty.
   * @returns PCM audio carrying the utterance.
   */
  synthesize(text: string): Promise<AudioClip>;
}
