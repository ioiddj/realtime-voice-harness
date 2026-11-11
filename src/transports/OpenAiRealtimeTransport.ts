/**
 * @file OpenAiRealtimeTransport.ts — REFERENCE implementation over the OpenAI
 * Realtime WebSocket API. NOT executed here: no live API key and no network
 * access in this environment, so audio encode/decode boundaries are marked
 * TODO (PCM16 base64) and no test performs I/O against the live service.
 * @module transports/OpenAiRealtimeTransport
 *
 * Uses ONLY the global WebSocket (no new dependencies). NOTE: the global
 * browser-style WebSocket cannot send custom headers, so production use
 * needs an auth-capable socket (e.g. a Node `ws` client sending
 * `Authorization: Bearer <key>` plus `OpenAI-Beta: realtime=v1`, see
 * {@link OpenAiRealtimeTransport.getAuthorizationHeader}), or a
 * backend-issued ephemeral token passed as a URL/query subprotocol per the
 * public Realtime API docs. That wiring is the main TODO below.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';

/** Options for the OpenAI Realtime reference transport. */
export interface OpenAiRealtimeTransportOptions {
  /** API key (or ephemeral client token). Must be non-empty. */
  readonly apiKey: string;
  /** Realtime model name. */
  readonly model?: string;
  /** Voice preset for audio replies. */
  readonly voice?: string;
}

/** Default realtime model used when none is supplied. */
export const DEFAULT_REALTIME_MODEL: string = 'gpt-4o-realtime-preview';

/** Default voice preset used when none is supplied. */
export const DEFAULT_REALTIME_VOICE: string = 'alloy';

/**
 * Normalizes an unknown catch value to an Error.
 * @param error - Caught value.
 * @returns The value as an Error.
 */
function asError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('OpenAiRealtimeTransport operation failed.');
}

/**
 * Reference `IRealtimeTransport` over the OpenAI Realtime WebSocket API.
 * Every method is type-correct; methods that need a live session reject
 * with plain Errors while unconnected and perform no I/O in that state.
 */
export class OpenAiRealtimeTransport implements IRealtimeTransport {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly voice: string;
  private readonly listeners = new Set<AudioListener>();
  private socket: WebSocket | null = null;

  /**
   * Creates the transport. Does not open any connection.
   * @param options - API key plus optional model and voice overrides.
   */
  public constructor(options: OpenAiRealtimeTransportOptions) {
    if (options.apiKey.length === 0) {
      throw new Error('OpenAiRealtimeTransport requires a non-empty apiKey.');
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_REALTIME_MODEL;
    this.voice = options.voice ?? DEFAULT_REALTIME_VOICE;
  }

  /** Returns the configured model name. */
  public getModel(): string {
    return this.model;
  }

  /** Returns the configured voice preset. */
  public getVoice(): string {
    return this.voice;
  }

  /**
   * Returns the Authorization header value for a headers-capable client.
   * @returns The bearer header for the configured key.
   */
  public getAuthorizationHeader(): string {
    return `Bearer ${this.apiKey}`;
  }

  /**
   * Opens the Realtime WebSocket session and sends `session.update`.
   * TODO: pass auth (ephemeral token / headers-capable client) and decode
   * `response.audio.delta` (base64 PCM16) events into AudioClips.
   * @returns Nothing; resolves when the socket opens.
   */
  public connect(): Promise<void> {
    if (this.socket !== null) {
      return Promise.reject(
        new Error('OpenAiRealtimeTransport is already connected.')
      );
    }
    // NOTE: global WebSocket cannot set the `Authorization` / `OpenAI-Beta`
    // headers the live API requires; a headers-capable client (or an
    // ephemeral-token URL) replaces this line in production.
    const socket = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`
    );
    this.socket = socket;
    socket.addEventListener('message', (event: MessageEvent) => {
      const clip = this.decodeAudioEvent(event.data);
      if (clip !== null) {
        for (const listener of this.listeners) {
          listener(clip);
        }
      }
    });
    return new Promise<void>((resolve, reject) => {
      socket.addEventListener(
        'open',
        () => {
          socket.send(
            JSON.stringify({
              type: 'session.update',
              session: this.buildSessionUpdate(),
            })
          );
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        'error',
        () => {
          reject(new Error('OpenAiRealtimeTransport failed to connect.'));
        },
        { once: true }
      );
    });
  }

  /** Closes the session and drops listeners. No-op while unconnected. */
  public disconnect(): Promise<void> {
    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
    this.listeners.clear();
    return Promise.resolve();
  }

  /**
   * Appends outbound audio to the session buffer.
   * TODO: encode `audio.samples` (Float32 [-1, 1]) to base64 PCM16 and send
   * `input_audio_buffer.append` (+ `commit` per turn strategy).
   * @param audio - PCM audio to deliver.
   */
  public sendAudio(audio: AudioClip): Promise<void> {
    try {
      const socket = this.requireSocket();
      socket.send(this.encodeAudioClip(audio));
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(asError(error));
    }
  }

  /**
   * Sends a typed message through the session.
   * @param text - Message to deliver. Must be non-empty.
   */
  public sendText(text: string): Promise<void> {
    try {
      if (text.length === 0) {
        throw new Error('OpenAiRealtimeTransport requires non-empty text.');
      }
      const socket = this.requireSocket();
      socket.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
        })
      );
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(asError(error));
    }
  }

  /**
   * Registers an inbound-audio listener.
   * @param listener - Callback invoked per decoded audio segment.
   * @returns Unsubscribe function.
   */
  public onAudio(listener: AudioListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Builds the `session.update` payload for the configured model and voice.
   * @returns Serializable session parameters (no I/O).
   */
  private buildSessionUpdate(): Record<string, unknown> {
    return {
      model: this.model,
      voice: this.voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
    };
  }

  private requireSocket(): WebSocket {
    if (this.socket === null) {
      throw new Error('OpenAiRealtimeTransport is not connected.');
    }
    return this.socket;
  }

  /**
   * Encodes a clip to base64 PCM16 for `input_audio_buffer.append`.
   * @param _audio - Clip whose samples would be encoded.
   * @returns The base64 PCM16 payload.
   */
  private encodeAudioClip(_audio: AudioClip): string {
    // TODO: convert Float32 [-1, 1] samples to base64 PCM16.
    throw new Error(
      'OpenAiRealtimeTransport PCM16 audio encoding is not implemented (reference only).'
    );
  }

  /**
   * Decodes a server event into audio for listeners.
   * @param _data - Raw WebSocket message payload.
   * @returns The decoded clip, or null for non-audio events.
   */
  private decodeAudioEvent(_data: unknown): AudioClip | null {
    // TODO: parse `response.audio.delta` JSON, base64-decode the PCM16
    // payload to Float32 samples, and return the clip.
    return null;
  }
}
