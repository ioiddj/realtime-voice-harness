/**
 * @file TanStackTransport.ts — `IRealtimeTransport` over a TanStack AI
 * realtime connection.
 * @module transports/TanStackTransport
 *
 * Lets the harness speak/listen through any `@tanstack/ai`
 * `RealtimeAdapter` (OpenAI, custom cascade adapters such as Innerview's
 * `nvidiaRealtime`, or `FakeTanStackAdapter` in tests): outbound audio is
 * transcribed to text and forwarded via `connection.sendText`, while final
 * assistant transcripts are synthesized back to audio and emitted to
 * `onAudio` listeners — the same text-in/text-out contract as every other
 * transport.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import type { ISpeechSynthesizer } from '../speech/ISpeechSynthesizer.js';
import type { ISpeechTranscriber } from '../speech/ISpeechTranscriber.js';
import type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';
import type {
  RealtimeAdapter,
  RealtimeConnection,
  RealtimeToken,
} from '@tanstack/ai';

/** Options for {@link TanStackTransport}. */
export interface TanStackTransportOptions {
  /** TanStack realtime adapter backing the connection. */
  readonly adapter: RealtimeAdapter;
  /** Resolves the token the adapter connects with. */
  readonly getToken: () => Promise<RealtimeToken>;
  /** Transcribes outbound harness audio to app text. */
  readonly transcriber: ISpeechTranscriber;
  /** Synthesizes inbound assistant transcripts to reply audio. */
  readonly synthesizer: ISpeechSynthesizer;
}

/**
 * Harness transport driving a TanStack realtime connection.
 */
export class TanStackTransport implements IRealtimeTransport {
  private readonly adapter: RealtimeAdapter;
  private readonly getToken: () => Promise<RealtimeToken>;
  private readonly transcriber: ISpeechTranscriber;
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly listeners = new Set<AudioListener>();
  private connection: RealtimeConnection | null = null;
  private detach: Unsubscribe[] = [];
  private pendingError: Error | null = null;

  /**
   * Creates the transport. Does not connect; call `connect()` first.
   * @param options - Adapter, token provider, and speech drivers.
   */
  public constructor(options: TanStackTransportOptions) {
    this.adapter = options.adapter;
    this.getToken = options.getToken;
    this.transcriber = options.transcriber;
    this.synthesizer = options.synthesizer;
  }

  /**
   * Opens the TanStack connection and subscribes to its events.
   * @returns Nothing; resolves when the connection is established.
   */
  public async connect(): Promise<void> {
    if (this.connection !== null) {
      throw new Error('TanStackTransport is already connected.');
    }
    const token = await this.getToken();
    const connection = await this.adapter.connect(token);
    this.connection = connection;
    this.detach = [
      connection.on('transcript', (payload) => {
        void this.onTranscript(payload.role, payload.transcript, payload.isFinal);
      }),
      connection.on('error', (payload) => {
        this.pendingError = payload.error;
      }),
    ];
  }

  /** Detaches listeners and closes the TanStack connection. */
  public async disconnect(): Promise<void> {
    for (const off of this.detach) {
      off();
    }
    this.detach = [];
    this.listeners.clear();
    const connection = this.connection;
    this.connection = null;
    this.pendingError = null;
    if (connection !== null) {
      await connection.disconnect();
    }
  }

  /**
   * Transcribes harness audio and forwards the text to the connection.
   * @param audio - PCM audio to deliver as user text.
   */
  public async sendAudio(audio: AudioClip): Promise<void> {
    const connection = this.requireConnection();
    this.throwIfPendingError();
    const text = (await this.transcriber.transcribe(audio)).text.trim();
    if (text.length === 0) {
      throw new Error('TanStackTransport heard no speech to forward.');
    }
    connection.sendText(text);
  }

  /**
   * Forwards text directly, skipping transcription.
   * @param text - Message to deliver. Must be non-empty.
   */
  public sendText(text: string): Promise<void> {
    const connection = this.requireConnection();
    this.throwIfPendingError();
    if (text.trim().length === 0) {
      return Promise.reject(new Error('TanStackTransport needs non-empty text.'));
    }
    connection.sendText(text);
    return Promise.resolve();
  }

  /**
   * Registers an inbound-audio listener (assistant replies as audio).
   * @param listener - Callback invoked per reply segment.
   * @returns Unsubscribe function.
   */
  public onAudio(listener: AudioListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async onTranscript(
    role: 'user' | 'assistant',
    transcript: string,
    isFinal: boolean
  ): Promise<void> {
    if (!isFinal || role !== 'assistant') return;
    const text = transcript.trim();
    if (text.length === 0 || this.connection === null) return;
    const reply = await this.synthesizer.synthesize(text);
    // Tagged as a reply so transcriber doubles resolve it symmetrically.
    const tagged: AudioClip = { ...reply, tag: `reply:${text}` };
    for (const listener of this.listeners) {
      listener(tagged);
    }
  }

  private requireConnection(): RealtimeConnection {
    if (this.connection === null) {
      throw new Error('TanStackTransport is not connected.');
    }
    return this.connection;
  }

  private throwIfPendingError(): void {
    if (this.pendingError !== null) {
      const error = this.pendingError;
      this.pendingError = null;
      throw error;
    }
  }
}
