/**
 * @file LangChainTransport.ts — In-process app double backed by a LangChain runnable.
 * @module transports/LangChainTransport
 *
 * Bridges the harness transport contract to any LangChain runnable-style
 * function: inbound audio is transcribed to text, passed through `invoke`,
 * and the reply text is synthesized back to audio for harness listeners.
 * Accepts the plain function `(text: string) => Promise<string>` (NOT a
 * LangChain type) to avoid version coupling; a RunnableLambda or agent
 * executor adapts with one line, e.g. `(text) => runnable.invoke(text)`.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import type { ISpeechSynthesizer } from '../speech/ISpeechSynthesizer.js';
import type { ISpeechTranscriber } from '../speech/ISpeechTranscriber.js';
import type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';

/** Dependencies injected into the LangChain-backed app double. */
export interface LangChainTransportOptions {
  /** Runnable-style function, e.g. `(text) => runnable.invoke(text)`. */
  readonly invoke: (text: string) => Promise<string>;
  /** Speech-to-text driver for inbound audio. */
  readonly transcriber: ISpeechTranscriber;
  /** Text-to-speech driver for replies. */
  readonly synthesizer: ISpeechSynthesizer;
}

/**
 * In-process `IRealtimeTransport` whose "app" is a LangChain runnable.
 */
export class LangChainTransport implements IRealtimeTransport {
  private readonly invoke: (text: string) => Promise<string>;
  private readonly transcriber: ISpeechTranscriber;
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly listeners = new Set<AudioListener>();
  private connected = false;

  /**
   * Creates the transport from a runnable-style function and speech drivers.
   * @param options - Invoke function plus transcriber and synthesizer.
   */
  public constructor(options: LangChainTransportOptions) {
    this.invoke = options.invoke;
    this.transcriber = options.transcriber;
    this.synthesizer = options.synthesizer;
  }

  /** Opens the in-process session. */
  public connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  /** Closes the in-process session and drops listeners. */
  public disconnect(): Promise<void> {
    this.connected = false;
    this.listeners.clear();
    return Promise.resolve();
  }

  /**
    * Transcribes inbound audio, runs the LangChain function, synthesizes the
   * reply, and emits it to listeners asynchronously.
   * @param audio - Inbound utterance from the harness.
   */
  public async sendAudio(audio: AudioClip): Promise<void> {
    if (!this.connected) {
      throw new Error('LangChainTransport is not connected.');
    }
    const input = (await this.transcriber.transcribe(audio)).text;
    const replyText = await this.invoke(input);
    await this.emitReply(replyText);
  }

  /**
   * Runs the LangChain function directly on typed input and emits the
   * synthesized reply, for apps that accept a text side channel.
   * @param text - Message to deliver.
   */
  public async sendText(text: string): Promise<void> {
    if (!this.connected) {
      throw new Error('LangChainTransport is not connected.');
    }
    const replyText = await this.invoke(text);
    await this.emitReply(replyText);
  }

  /**
   * Synthesizes one reply and emits it to listeners asynchronously.
   * @param replyText - Reply text to vocalize.
   * @returns Nothing; delivery happens on the microtask queue.
   */
  private async emitReply(replyText: string): Promise<void> {
    const reply = await this.synthesizer.synthesize(replyText);
    const tagged: AudioClip = {
      ...reply,
      tag: `reply:${replyText}`,
    };
    queueMicrotask(() => {
      for (const listener of this.listeners) {
        listener(tagged);
      }
    });
  }

  /**
   * Registers an inbound-audio listener.
   * @param listener - Callback invoked per reply segment.
   * @returns Unsubscribe function.
   */
  public onAudio(listener: AudioListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
