/**
 * @file FakeDoubles.ts — In-memory test doubles for the harness boundaries.
 * @module fakes/FakeDoubles
 *
 * Deterministic, dependency-free doubles: the synthesizer tags each clip
 * with its source text, the transcriber resolves known tags back to text,
 * and the scripted app double answers inbound audio with canned replies.
 * Real adapters (HTTP TTS/STT, WebSocket transports) implement the same
 * interfaces without changing harness code.
 */
import { DEFAULT_SAMPLE_RATE, type AudioClip } from '../audio/AudioClip.js';
import {
  isFakeVoiceName,
  renderVoiceSamples,
  type FakeVoiceName,
} from './VoicePresets.js';
import type { ISpeechSynthesizer } from '../speech/ISpeechSynthesizer.js';
import type {
  ISpeechTranscriber,
  TranscriptionResult,
} from '../speech/ISpeechTranscriber.js';
import type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from '../transport/IRealtimeTransport.js';

/**
 * Synthesizer double: renders one voice's PCM signature per utterance and
 * tags the clip with voice and text so the transcriber double can resolve it.
 */
export class FakeSynthesizer implements ISpeechSynthesizer {
  private readonly voice: FakeVoiceName;

  /**
   * Creates the synthesizer double.
   * @param voice - Voice signature to render. Defaults to `'default'`.
   */
  public constructor(voice: FakeVoiceName = 'default') {
    this.voice = voice;
  }

  /** Returns the voice this synthesizer renders. */
  public getVoice(): FakeVoiceName {
    return this.voice;
  }

  /**
   * Synthesizes deterministic tagged audio in the selected voice.
   * @param text - Utterance to "speak". Must be non-empty.
   * @returns Tagged PCM clip (`say:<voice>:<text>`).
   */
  public synthesize(text: string): Promise<AudioClip> {
    if (text.length === 0) {
      throw new Error('FakeSynthesizer requires non-empty text.');
    }
    return Promise.resolve({
      samples: renderVoiceSamples(text, this.voice),
      sampleRate: DEFAULT_SAMPLE_RATE,
      tag: `say:${this.voice}:${text}`,
    });
  }
}

/**
 * Transcriber double: resolves clips by tag, falling back to a fixed
 * unknown marker so tests fail loudly instead of silently.
 */
export class FakeTranscriber implements ISpeechTranscriber {
  private readonly knownReplies: ReadonlyMap<string, string>;

  /**
   * Creates a transcriber with tag-to-text resolutions.
   * @param knownReplies - Map from clip tag to transcript.
   */
  public constructor(knownReplies: ReadonlyMap<string, string> = new Map()) {
    this.knownReplies = knownReplies;
  }

  /**
   * Resolves the clip tag to text. `say:<voice>:<text>` tags resolve to
   * `<text>` regardless of voice; bare `say:<text>` tags (pre-voice format)
   * resolve as before. `reply:` prefixes resolve symmetrically; anything
   * else falls back to the known-replies map, keyed by full tag, e.g.
   * `new Map([['say:mlg:Hello', 'Hello']])`.
   * @param audio - Clip produced by {@link FakeSynthesizer} or the app double.
   * @returns The resolved transcript.
   */
  public transcribe(audio: AudioClip): Promise<TranscriptionResult> {
    if (audio.tag !== undefined) {
      const known = this.knownReplies.get(audio.tag);
      if (known !== undefined) {
        return Promise.resolve({ text: known, confidence: 1 });
      }
      if (audio.tag.startsWith('say:') || audio.tag.startsWith('reply:')) {
        const rest = audio.tag.slice(audio.tag.indexOf(':') + 1);
        const separator = rest.indexOf(':');
        const voice = separator < 0 ? '' : rest.slice(0, separator);
        const text = separator < 0 || !isFakeVoiceName(voice) ? rest : rest.slice(separator + 1);
        return Promise.resolve({ text, confidence: 1 });
      }
    }
    return Promise.resolve({ text: '[unrecognized]', confidence: 0 });
  }
}

/**
 * App double: answers each inbound utterance with the next scripted reply,
 * synthesized through the provided synthesizer (tagged as a reply clip).
 */
export class ScriptedAppTransport implements IRealtimeTransport {
  private readonly synthesizer: ISpeechSynthesizer;
  private readonly replies: readonly string[];
  private readonly listeners = new Set<AudioListener>();
  private replyIndex = 0;
  private connected = false;

  /**
   * Creates the app double.
   * @param synthesizer - Used to render scripted replies as audio.
   * @param replies - Reply texts, consumed in order (last repeats).
   */
  public constructor(synthesizer: ISpeechSynthesizer, replies: readonly string[]) {
    this.synthesizer = synthesizer;
    this.replies = replies;
  }

  /** Opens the fake session. */
  public connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  /** Closes the fake session. */
  public disconnect(): Promise<void> {
    this.connected = false;
    this.listeners.clear();
    return Promise.resolve();
  }

  /**
   * Restarts the reply sequence from the first scripted reply, so the
   * transport can be reused across tests without leaking sequence position.
   * Listeners and connection state are untouched.
   * @returns Nothing.
   */
  public reset(): void {
    this.replyIndex = 0;
  }

  /**
   * Accepts inbound audio and emits the next scripted reply asynchronously,
   * mimicking network + inference latency.
   * @param _audio - Inbound utterance (content ignored; order matters).
   */
  public async sendAudio(_audio: AudioClip): Promise<void> {
    if (!this.connected) {
      throw new Error('ScriptedAppTransport is not connected.');
    }
    if (this.replies.length === 0) {
      throw new Error('ScriptedAppTransport has no scripted replies.');
    }
    const index = Math.min(this.replyIndex, this.replies.length - 1);
    this.replyIndex += 1;
    const replyText = this.replies[index] as string;
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
