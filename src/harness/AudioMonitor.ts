/**
 * @file AudioMonitor.ts — Observability control surface for harness runs.
 * @module harness/AudioMonitor
 *
 * An `IAudioMonitor` receives a structured event per harness stage (turn
 * start, outbound audio, reply audio, transcript, turn finish), so developers
 * can log, record, or visualize a voice test without touching its assertions.
 * Attach one via `HarnessDrivers.monitor`; the harness works unchanged
 * without it.
 */
import type { AudioClip } from '../audio/AudioClip.js';
import type { TurnResult } from './VoiceConversationHarness.js';

/** One observability event emitted during a harness turn. */
export type MonitorEvent =
  | { readonly kind: 'turn-started'; readonly turnIndex: number; readonly say: string }
  | { readonly kind: 'outbound-audio'; readonly turnIndex: number; readonly clip: AudioClip }
  | { readonly kind: 'reply-audio'; readonly turnIndex: number; readonly clip: AudioClip | null }
  | { readonly kind: 'transcript'; readonly turnIndex: number; readonly text: string }
  | { readonly kind: 'turn-finished'; readonly turnIndex: number; readonly result: TurnResult };

/**
 * Receives harness monitor events. Implementations must not throw;
 * the harness never awaits or depends on monitor delivery.
 */
export interface IAudioMonitor {
  /**
   * Handles one monitor event.
   * @param event - The stage that just completed (or started).
   */
  onEvent(event: MonitorEvent): void;
}

/**
 * Monitor that logs one line per event to the console for live debugging.
 */
export class ConsoleAudioMonitor implements IAudioMonitor {
  private readonly prefix: string;

  /**
   * Creates the console monitor.
   * @param prefix - Label prepended to every line. Defaults to `'[voice]'`.
   */
  public constructor(prefix: string = '[voice]') {
    this.prefix = prefix;
  }

  /**
   * Logs the event (audio reported as sample counts/durations, never dumped).
   * @param event - The event to log.
   */
  public onEvent(event: MonitorEvent): void {
    const tag = `${this.prefix} turn#${String(event.turnIndex)} ${event.kind}`;
    switch (event.kind) {
      case 'turn-started':
        console.log(`${tag}: say=${JSON.stringify(event.say)}`);
        break;
      case 'outbound-audio':
      case 'reply-audio':
        if (event.clip === null) {
          console.log(`${tag}: (silence)`);
        } else {
          const seconds = event.clip.samples.length / event.clip.sampleRate;
          console.log(
            `${tag}: ${String(event.clip.samples.length)} samples, ` +
              `${seconds.toFixed(2)}s @ ${String(event.clip.sampleRate)}Hz`
          );
        }
        break;
      case 'transcript':
        console.log(`${tag}: heard=${JSON.stringify(event.text)}`);
        break;
      case 'turn-finished':
        console.log(
          `${tag}: roundTripMs=${String(event.result.roundTripMs)} ` +
            `heard=${JSON.stringify(event.result.heard)}`
        );
        break;
    }
  }
}
