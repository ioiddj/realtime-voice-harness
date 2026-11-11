/**
 * @file AguiSseTransport.ts — AG-UI SSE transport for OpenAI-compatible agent endpoints.
 * @module transports/AguiSseTransport
 *
 * Transcribes outbound audio to text, POSTs it to an AG-UI chat endpoint
 * (the Innerview `/api/chat` shape), accumulates `TEXT_MESSAGE_CONTENT`
 * deltas from the SSE stream, synthesizes the full reply, and emits it to
 * `onAudio` listeners. Dependency-free: uses only the global `fetch`.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import type { ISpeechSynthesizer } from '../speech/ISpeechSynthesizer.js';
import type { ISpeechTranscriber } from '../speech/ISpeechTranscriber.js';
import type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';

/** Options for {@link AguiSseTransport}. */
export interface AguiSseTransportOptions {
  /** Endpoint origin, e.g. `http://127.0.0.1:3099`. Trailing slashes are trimmed. */
  readonly baseUrl: string;
  /** Transcriber used to convert outbound audio to chat text. */
  readonly transcriber: ISpeechTranscriber;
  /** Synthesizer used to render the streamed reply as audio. */
  readonly synthesizer: ISpeechSynthesizer;
  /** Thread/conversation id sent with each chat request. */
  readonly threadId?: string;
  /** Extra headers merged into the chat POST (e.g. authorization). */
  readonly headers?: Record<string, string>;
  /** Chat path appended to `baseUrl`. Defaults to `/api/chat`. */
  readonly chatPath?: string;
  /**
   * Extra top-level fields merged into the chat POST body (e.g.
   * `forwardedProps` carrying generation settings for the server).
   */
  readonly extraBody?: Record<string, unknown>;
}

/** Default chat path when none is supplied. */
export const DEFAULT_CHAT_PATH: string = '/api/chat';

/**
 * Accumulates assistant text from an AG-UI SSE body.
 * @param body - Raw `text/event-stream` payload (`data:` lines).
 * @returns Concatenated `TEXT_MESSAGE_CONTENT` deltas.
 */
export function parseAguiSseText(body: string): string {
  const parts: string[] = [];
  const lines: string[] = body.split('\n');
  for (const rawLine of lines) {
    const line: string = rawLine.trim();
    if (!line.startsWith('data:')) {
      continue;
    }
    const payload: string = line.slice('data:'.length).trim();
    if (payload === '' || payload === '[DONE]') {
      continue;
    }
    let event: { type?: unknown; delta?: unknown; content?: unknown; message?: unknown };
    try {
      event = JSON.parse(payload) as {
        type?: unknown;
        delta?: unknown;
        content?: unknown;
        message?: unknown;
      };
    } catch {
      continue;
    }
    if (event.type === 'RUN_ERROR') {
      const detail: string =
        typeof event.message === 'string' ? event.message : payload;
      throw new Error(`AguiSseTransport: agent run failed: ${detail}`);
    }
    if (event.type !== 'TEXT_MESSAGE_CONTENT') {
      continue;
    }
    if (typeof event.delta === 'string') {
      parts.push(event.delta);
    } else if (typeof event.content === 'string') {
      parts.push(event.content);
    }
  }
  return parts.join('');
}

/**
 * Realtime transport backed by an AG-UI SSE chat endpoint.
 */
export class AguiSseTransport implements IRealtimeTransport {
  private readonly baseUrl: string;
  private readonly transcriber: ISpeechTranscriber;
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly threadId: string | undefined;
  private readonly headers: Record<string, string>;
  private readonly chatPath: string;
  private readonly extraBody: Record<string, unknown>;
  private readonly listeners = new Set<AudioListener>();
  private connected = false;

  /**
   * Creates the transport.
   * @param options - Endpoint, drivers, and request options.
   */
  public constructor(options: AguiSseTransportOptions) {
    if (options.baseUrl.trim() === '') {
      throw new Error('AguiSseTransport requires a non-empty baseUrl.');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.transcriber = options.transcriber;
    this.synthesizer = options.synthesizer;
    this.threadId = options.threadId;
    this.headers = { ...(options.headers ?? {}) };
    this.chatPath = options.chatPath ?? DEFAULT_CHAT_PATH;
    this.extraBody = { ...(options.extraBody ?? {}) };
  }

  /** Marks the transport ready (no persistent connection; chat is per-turn POST). */
  public connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  /** Clears listeners and marks the transport closed. */
  public disconnect(): Promise<void> {
    this.connected = false;
    this.listeners.clear();
    return Promise.resolve();
  }

  /**
   * Transcribes audio, chats, synthesizes the reply, and emits it.
   * @param audio - Outbound utterance to transcribe and send.
   */
  public async sendAudio(audio: AudioClip): Promise<void> {
    this.assertConnected();
    let text: string;
    try {
      text = (await this.transcriber.transcribe(audio)).text.trim();
    } catch (error) {
      throw new Error(
        `AguiSseTransport: transcription failed: ${AguiSseTransport.describe(error)}`
      );
    }
    if (text === '') {
      throw new Error(
        'AguiSseTransport: transcription produced empty text; nothing to send.'
      );
    }
    await this.postText(text);
  }

  /**
   * Sends typed text directly, bypassing transcription.
   * @param text - Message to deliver.
   */
  public async sendText(text: string): Promise<void> {
    this.assertConnected();
    if (text.trim() === '') {
      throw new Error('AguiSseTransport: cannot send empty text.');
    }
    await this.postText(text);
  }

  /**
   * Registers an inbound-audio listener.
   * @param listener - Callback invoked per synthesized reply.
   * @returns Unsubscribe function.
   */
  public onAudio(listener: AudioListener): Unsubscribe {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error(
        'AguiSseTransport is not connected. Call connect() first.'
      );
    }
  }

  private async postText(text: string): Promise<void> {
    const url: string = `${this.baseUrl}${this.chatPath}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.headers,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          threadId: this.threadId,
          ...this.extraBody,
        }),
      });
    } catch (error) {
      throw new Error(
        `AguiSseTransport: request to ${url} failed: ${AguiSseTransport.describe(error)}`
      );
    }
    if (!response.ok) {
      const snippet: string = await AguiSseTransport.readSnippet(response);
      throw new Error(
        `AguiSseTransport: chat request failed with HTTP ${String(response.status)} ${response.statusText} from ${url}: ${snippet}`
      );
    }
    let body: string;
    try {
      body = await response.text();
    } catch (error) {
      throw new Error(
        `AguiSseTransport: failed to read SSE body from ${url}: ${AguiSseTransport.describe(error)}`
      );
    }
    const reply: string = parseAguiSseText(body).trim();
    if (reply === '') {
      throw new Error(
        `AguiSseTransport: no TEXT_MESSAGE_CONTENT deltas in SSE response from ${url}. Body snippet: ${body.slice(0, 200)}`
      );
    }
    let clip: AudioClip;
    try {
      clip = await this.synthesizer.synthesize(reply);
    } catch (error) {
      throw new Error(
        `AguiSseTransport: synthesis of reply failed: ${AguiSseTransport.describe(error)}`
      );
    }
    for (const listener of this.listeners) {
      listener(clip);
    }
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static async readSnippet(response: Response): Promise<string> {
    try {
      const text: string = await response.text();
      return text.slice(0, 200);
    } catch {
      return '(unreadable body)';
    }
  }
}
