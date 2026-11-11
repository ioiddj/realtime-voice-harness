/**
 * @file IRealtimeTransport.ts — Voice-app transport contract.
 * @module transport/IRealtimeTransport
 *
 * Abstracts the connection to the app under test: a realtime voice endpoint,
 * a WebSocket gateway, or an in-process double. Audio flows in both
 * directions; text is an optional side channel for apps that accept it.
 */
import type { AudioClip } from '../audio/AudioClip.js';

/** Listener invoked for each inbound audio segment. */
export type AudioListener = (audio: AudioClip) => void;

/** Unsubscribe function returned when registering a listener. */
export type Unsubscribe = () => void;

/** Realtime voice transport contract. */
export interface IRealtimeTransport {
  /**
   * Opens the connection to the app under test.
   * @returns Nothing; resolves when the session is ready.
   */
  connect(): Promise<void>;
  /** Closes the connection and releases its resources. */
  disconnect(): Promise<void>;
  /**
   * Sends an outbound audio segment to the app.
   * @param audio - PCM audio to deliver.
   */
  sendAudio(audio: AudioClip): Promise<void>;
  /**
   * Sends a text message when the app accepts typed input.
   * @param text - Message to deliver.
   */
  sendText?(text: string): Promise<void>;
  /**
   * Registers a listener for inbound audio segments.
   * @param listener - Callback invoked per segment.
   * @returns Unsubscribe function.
   */
  onAudio(listener: AudioListener): Unsubscribe;
}
