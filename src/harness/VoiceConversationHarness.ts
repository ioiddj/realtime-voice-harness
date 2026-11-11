/**
 * @file VoiceConversationHarness.ts — Text-in/text-out driver for realtime
 * voice apps backed by agentic harnesses.
 * @module harness/VoiceConversationHarness
 *
 * The harness lets a test "speak" and "listen" purely with text: it
 * synthesizes each scripted line, streams the audio through the transport,
 * captures the app's audio reply, transcribes it back to text, and hands the
 * transcript to caller-supplied assertions. All I/O boundaries are
 * constructor-injected interfaces, so tests swap engines without touching
 * the conversation logic.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import { concatClips } from '../audio/AudioClip.js';
import type { ISpeechSynthesizer } from '../speech/ISpeechSynthesizer.js';
import type { ISpeechTranscriber } from '../speech/ISpeechTranscriber.js';
import type {
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';
import type { IAudioMonitor, MonitorEvent } from './AudioMonitor.js';

/** One scripted user turn. */
export interface ScriptedTurn {
  /** What the harness "says" (synthesized to audio). */
  readonly say: string;
  /**
   * Optional assertion over the app's transcribed reply. May be async to
   * support frameworks with asynchronous matchers; rejections fail the turn.
   */
  readonly expectReply?: (reply: string) => void | Promise<void>;
}

/** Per-turn overrides for {@link VoiceConversationHarness.speak}. */
export interface SpeakOptions {
  /** Max wait for reply audio before giving up. Defaults to 30_000. */
  readonly timeoutMs?: number;
  /**
   * Silence policy on timeout. `'empty'` (default) resolves with an empty
   * transcript; `'throw'` rejects with a plain Error naming the wait.
   * Prefer `'throw'` in new suites — it fails at the cause, not downstream.
   */
  readonly onTimeout?: 'throw' | 'empty';
}

/** Result of one executed turn. */
export interface TurnResult {
  /** Scripted input text. */
  readonly said: string;
  /** Transcribed reply text from the app. */
  readonly heard: string;
  /** Milliseconds from send to completed transcription. */
  readonly roundTripMs: number;
  /** Synthesized outbound audio (hear it, save it, assert on it). */
  readonly outbound: AudioClip;
  /** Captured reply audio, or null when the app stayed silent. */
  readonly reply: AudioClip | null;
}

/** Dependencies injected into the harness (all interfaces, no concretes). */
export interface HarnessDrivers {
  readonly synthesizer: ISpeechSynthesizer;
  readonly transcriber: ISpeechTranscriber;
  readonly transport: IRealtimeTransport;
  /**
   * Optional observability sink receiving per-stage monitor events.
   * The harness runs identically with or without one.
   */
  readonly monitor?: IAudioMonitor;
}

/**
 * Drives scripted voice conversations against an app under test.
 *
 * @typeParam TSession - Opaque session handle type, threaded through turns
 * for harnesses that need per-session state (defaults to `unknown`).
 */
export class VoiceConversationHarness<TSession = unknown> {
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly transcriber: ISpeechTranscriber;
  private readonly transport: IRealtimeTransport;
  private readonly monitor: IAudioMonitor | undefined;
  private readonly session: TSession | undefined;
  private inbound: AudioClip[] = [];
  private unsubscribe: Unsubscribe | null = null;
  private turnCounter = 0;

  /**
   * Creates a harness from its drivers.
   * @param drivers - Synthesizer, transcriber, and transport implementations.
   * @param session - Optional per-session state threaded through turns.
   */
  public constructor(drivers: HarnessDrivers, session?: TSession) {
    this.synthesizer = drivers.synthesizer;
    this.transcriber = drivers.transcriber;
    this.transport = drivers.transport;
    this.monitor = drivers.monitor;
    this.session = session;
  }

  /** Returns the session handle passed at construction. */
  public getSession(): TSession | undefined {
    return this.session;
  }

  /**
   * Opens the transport and starts capturing inbound audio.
   * @returns Nothing; resolves when the session is ready.
   */
  public async connect(): Promise<void> {
    await this.transport.connect();
    this.unsubscribe = this.transport.onAudio((audio: AudioClip) => {
      this.inbound.push(audio);
    });
  }

  /** Stops capture and closes the transport. */
  public async disconnect(): Promise<void> {
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    await this.transport.disconnect();
  }

  /**
   * Speaks one scripted line and returns the app's transcribed reply.
   * @param say - Text to synthesize and send.
   * @param options - Per-turn overrides.
   * @returns The turn result with transcript and timing.
   */
  public async speak(
    say: string,
    options: SpeakOptions = {}
  ): Promise<TurnResult> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const onTimeout = options.onTimeout ?? 'empty';
    const turnIndex = this.turnCounter;
    this.turnCounter += 1;
    const startedAt = Date.now();
    this.notify({ kind: 'turn-started', turnIndex, say });
    const outbound = await this.synthesizer.synthesize(say);
    this.notify({ kind: 'outbound-audio', turnIndex, clip: outbound });
    const baseline = this.inbound.length;
    await this.transport.sendAudio(outbound);
    const replyAudio = await this.waitForReply(baseline, timeoutMs);
    if (replyAudio === null && onTimeout === 'throw') {
      throw new Error(
        `VoiceConversationHarness heard no reply within ${String(timeoutMs)}ms.`
      );
    }
    this.notify({ kind: 'reply-audio', turnIndex, clip: replyAudio });
    const replyText = replyAudio
      ? (await this.transcriber.transcribe(replyAudio)).text
      : '';
    const heard = replyText.trim();
    this.notify({ kind: 'transcript', turnIndex, text: heard });
    const result: TurnResult = {
      said: say,
      heard,
      roundTripMs: Date.now() - startedAt,
      outbound,
      reply: replyAudio,
    };
    this.notify({ kind: 'turn-finished', turnIndex, result });
    return result;
  }

  /**
   * Runs a full scripted conversation, applying each turn's assertion.
   * @param script - Ordered turns to execute.
   * @returns Per-turn results in script order.
   */
  public async runScript(script: readonly ScriptedTurn[]): Promise<TurnResult[]> {
    const results: TurnResult[] = [];
    for (const turn of script) {
      const result = await this.speak(turn.say);
      if (turn.expectReply) {
        await turn.expectReply(result.heard);
      }
      results.push(result);
    }
    return results;
  }

  /**
   * Delivers a monitor event without ever failing the turn: monitor bugs
   * must not break the test they observe.
   */
  private notify(event: MonitorEvent): void {
    if (this.monitor === undefined) return;
    try {
      this.monitor.onEvent(event);
    } catch {
      // Monitoring is best-effort by contract.
    }
  }

  private async waitForReply(
    baseline: number,
    timeoutMs: number
  ): Promise<AudioClip | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (this.inbound.length > baseline) {
        const clips = this.inbound.slice(baseline);
        this.inbound = [];
        const first = clips[0] as AudioClip;
        if (clips.length === 1) {
          return first;
        }
        // Multi-segment reply (chunked/streamed transport): keep the first
        // clip's tag so tagged doubles stay resolvable after the join.
        if (first.tag === undefined) {
          return concatClips(clips);
        }
        return concatClips(clips, { tag: first.tag });
      }
      if (Date.now() >= deadline) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}
