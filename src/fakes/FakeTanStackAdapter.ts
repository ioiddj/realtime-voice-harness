/**
 * @file FakeTanStackAdapter.ts — In-memory TanStack realtime adapter double.
 * @module fakes/FakeTanStackAdapter
 *
 * Deterministic `RealtimeAdapter` double for testing `TanStackTransport`
 * (and any other consumer of `@tanstack/ai` realtime connections) without a
 * provider, keys, or network. `sendText` answers with the next scripted
 * reply, emitting partial then final assistant transcripts plus a
 * `message_complete`, mirroring a streaming provider.
 */
import type {
  AudioVisualization,
  RealtimeAdapter,
  RealtimeConnection,
  RealtimeEvent,
  RealtimeEventHandler,
  RealtimeEventPayloads,
  RealtimeMessage,
  RealtimeSessionConfig,
  RealtimeToken,
} from '@tanstack/ai';

/** Provider id reported by the fake adapter. */
export const FAKE_TANSTACK_PROVIDER: string = 'fake-tanstack';

/**
 * Creates a minimal token for the fake adapter (no signing; local only).
 * @param model - Model id embedded in the token config.
 * @returns A well-formed `RealtimeToken`.
 */
export function createFakeToken(model: string = 'fake-cascade'): RealtimeToken {
  return {
    provider: FAKE_TANSTACK_PROVIDER,
    token: `fake-${model}`,
    expiresAt: Date.now() + 3_600_000,
    config: { model },
  };
}

/** Minimal typed event emitter (same surface as the TanStack helper). */
interface TypedEmitter {
  emit<TEvent extends RealtimeEvent>(
    event: TEvent,
    payload: RealtimeEventPayloads[TEvent]
  ): void;
  on<TEvent extends RealtimeEvent>(
    event: TEvent,
    handler: RealtimeEventHandler<TEvent>
  ): () => void;
}

/**
 * Creates a minimal typed event emitter.
 * @returns An emitter with subscribe/unsubscribe semantics.
 */
function createEmitter(): TypedEmitter {
  const handlers = new Map<string, Set<(payload: never) => void>>();
  return {
    emit: (event, payload) => {
      const set = handlers.get(event);
      if (!set) return;
      for (const handler of [...set]) {
        handler(payload as never);
      }
    },
    on: (event, handler) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      const typed = handler as (payload: never) => void;
      const active: Set<(payload: never) => void> = set;
      active.add(typed);
      return () => {
        active.delete(typed);
      };
    },
  };
}
/** Zeroed audio-visualization snapshot for the fake connection. */
function zeroVisualization(): AudioVisualization {
  return {
    inputLevel: 0,
    outputLevel: 0,
    getInputFrequencyData: () => new Uint8Array(0),
    getOutputFrequencyData: () => new Uint8Array(0),
    getInputTimeDomainData: () => new Uint8Array(0),
    getOutputTimeDomainData: () => new Uint8Array(0),
    inputSampleRate: 0,
    outputSampleRate: 24000,
  };
}

/**
 * In-memory realtime connection answering `sendText` with scripted replies.
 */
export class FakeTanStackConnection implements RealtimeConnection {
  private readonly emit: <TEvent extends RealtimeEvent>(
    event: TEvent,
    payload: RealtimeEventPayloads[TEvent]
  ) => void;
  private readonly onEvent: <TEvent extends RealtimeEvent>(
    event: TEvent,
    handler: RealtimeEventHandler<TEvent>
  ) => () => void;
  private readonly replies: readonly string[];
  private replyIndex = 0;
  private session: RealtimeSessionConfig;
  private disconnected = false;

  /**
   * Creates the fake connection.
   * @param replies - Reply texts, consumed in order (last repeats).
   * @param session - Initial session config.
   */
  public constructor(
    replies: readonly string[],
    session: RealtimeSessionConfig = {}
  ) {
    this.replies = replies;
    this.session = session;
    const emitter = createEmitter();
    this.emit = (event, payload) => {
      emitter.emit(event, payload);
    };
    this.onEvent = (event, handler) => emitter.on(event, handler);
  }

  /** Returns a copy of the current session config (test introspection). */
  public getSession(): RealtimeSessionConfig {
    return { ...this.session };
  }

  public on<TEvent extends RealtimeEvent>(
    event: TEvent,
    handler: RealtimeEventHandler<TEvent>
  ): () => void {
    return this.onEvent(event, handler);
  }

  public disconnect(): Promise<void> {
    this.disconnected = true;
    this.emit('status_change', { status: 'idle' });
    return Promise.resolve();
  }

  public startAudioCapture(): Promise<void> {
    this.throwIfDisconnected();
    return Promise.resolve();
  }

  public stopAudioCapture(): void {
    // No-op: the fake has no microphone.
  }

  public updateSession(config: Partial<RealtimeSessionConfig>): void {
    this.session = { ...this.session, ...config };
  }

  public updateToken(): void {
    // Local token: nothing to refresh.
  }

  public sendImage(): void {
    throw new Error('FakeTanStackConnection does not support image input.');
  }

  public sendToolResult(): void {
    // No tool calls are emitted; nothing to answer.
  }

  public interrupt(): void {
    this.emit('interrupted', {});
  }

  /**
   * Restarts the reply sequence from the first scripted reply, so the
   * connection can be reused across tests without leaking sequence position.
   * @returns Nothing.
   */
  public reset(): void {
    this.replyIndex = 0;
  }

  /**
   * Answers text with the next scripted reply, emitting a partial transcript,
   * a final transcript, and a message_complete asynchronously.
   * @param text - User text (content ignored; order matters).
   */
  public sendText(text: string): void {
    this.throwIfDisconnected();
    if (this.replies.length === 0) {
      throw new Error('FakeTanStackConnection has no scripted replies.');
    }
    const index = Math.min(this.replyIndex, this.replies.length - 1);
    this.replyIndex += 1;
    const reply = this.replies[index] as string;
    const messageId = `fake-msg-${String(this.replyIndex)}`;
    queueMicrotask(() => {
      if (this.disconnected) return;
      this.emit('transcript', { role: 'user', transcript: text, isFinal: true });
      const midpoint = Math.max(1, Math.floor(reply.length / 2));
      this.emit('transcript', {
        role: 'assistant',
        transcript: reply.slice(0, midpoint),
        isFinal: false,
      });
      this.emit('transcript', {
        role: 'assistant',
        transcript: reply,
        isFinal: true,
      });
      const message: RealtimeMessage = {
        id: messageId,
        role: 'assistant',
        timestamp: Date.now(),
        parts: [{ type: 'text', content: reply }],
      };
      this.emit('message_complete', { message });
    });
  }

  public getAudioVisualization(): AudioVisualization {
    return zeroVisualization();
  }

  private throwIfDisconnected(): void {
    if (this.disconnected) {
      throw new Error('FakeTanStackConnection is disconnected.');
    }
  }
}

/**
 * In-memory TanStack realtime adapter double with scripted replies.
 */
export class FakeTanStackAdapter implements RealtimeAdapter {
  public readonly provider: string = FAKE_TANSTACK_PROVIDER;
  private readonly replies: readonly string[];

  /**
   * Creates the fake adapter.
   * @param replies - Reply texts, consumed in order (last repeats).
   */
  public constructor(replies: readonly string[] = ['Hello, human.']) {
    this.replies = replies;
  }

  /**
   * Creates a fake connection (emits connecting/connected around setup).
   * @param _token - Accepted but unused; any well-formed token works.
   * @returns A connected `FakeTanStackConnection`.
   */
  public connect(_token: RealtimeToken): Promise<RealtimeConnection> {
    return Promise.resolve(
      new FakeTanStackConnection(this.replies)
    );
  }
}
