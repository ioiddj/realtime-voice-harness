/**
 * @file NodeWavFileSink.ts — `IAudioMonitor` that records harness audio to WAV.
 * @module sinks/NodeWavFileSink
 *
 * Node-only (uses `node:fs`/`node:path`). Attach to a harness to hear exactly
 * what the test synthesized and what the app replied: each turn writes
 * `turn-<n>-outbound.wav` and `turn-<n>-reply.wav` plus a `.txt` transcript,
 * playable with any audio player (`ffplay`, Audacity, a browser).
 */
/// <reference types="node" />
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodeWav } from '../audio/WavCodec.js';
import type { IAudioMonitor, MonitorEvent } from '../harness/AudioMonitor.js';

/** Options for {@link NodeWavFileSink}. */
export interface WavSinkOptions {
  /** Directory receiving the WAV files (created recursively). */
  readonly directory: string;
  /** Filename prefix. Defaults to `'voice-'`. */
  readonly prefix?: string;
}

/**
 * Records harness audio turns to WAV files for audible debugging.
 */
export class NodeWavFileSink implements IAudioMonitor {
  private readonly directory: string;
  private readonly prefix: string;
  private readonly written: string[] = [];
  private pending: Promise<void>[] = [];
  private ready: Promise<void> | null = null;

  /**
   * Creates the sink. Nothing is written until events arrive.
   * @param options - Output directory and filename prefix.
   */
  public constructor(options: WavSinkOptions) {
    if (options.directory.trim().length === 0) {
      throw new Error('NodeWavFileSink requires a non-empty directory.');
    }
    this.directory = options.directory;
    this.prefix = options.prefix ?? 'voice-';
  }

  /**
   * Handles one monitor event, queueing WAV/transcript writes.
   * @param event - The event to record.
   */
  public onEvent(event: MonitorEvent): void {
    if (
      event.kind !== 'outbound-audio' &&
      event.kind !== 'reply-audio' &&
      event.kind !== 'transcript'
    ) {
      return;
    }
    const side = event.kind === 'outbound-audio' ? 'outbound' : event.kind === 'reply-audio' ? 'reply' : 'heard';
    const task = this.ensureDirectory().then(async () => {
      if (event.kind === 'transcript') {
        const path = this.path(event.turnIndex, `${side}.txt`);
        await writeFile(path, event.text, 'utf8');
        this.written.push(path);
        return;
      }
      if (event.clip === null) return;
      const path = this.path(event.turnIndex, `${side}.wav`);
      await writeFile(path, encodeWav(event.clip));
      this.written.push(path);
    });
    this.pending.push(task);
    void task.catch(() => undefined).finally(() => {
      this.pending = this.pending.filter((p) => p !== task);
    });
  }

  /**
   * Waits for all queued writes to finish. Call before asserting on files.
   * @returns Nothing; write errors are swallowed (recording never fails tests).
   */
  public async drain(): Promise<void> {
    await Promise.all(this.pending.map((p) => p.catch(() => undefined)));
  }

  /** Returns the file paths written so far. */
  public getWrittenFiles(): readonly string[] {
    return [...this.written];
  }

  private path(turnIndex: number, suffix: string): string {
    return join(this.directory, `${this.prefix}turn-${String(turnIndex)}-${suffix}`);
  }

  private ensureDirectory(): Promise<void> {
    if (this.ready === null) {
      this.ready = mkdir(this.directory, { recursive: true }).then(() => undefined);
    }
    return this.ready;
  }
}
