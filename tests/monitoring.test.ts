/**
 * @file monitoring.test.ts — Audible debugging: WAV codec, monitor events, file sink.
 * @module tests/monitoring
 */
/// <reference types="node" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConsoleAudioMonitor,
  decodeWav,
  encodeWav,
  FakeSynthesizer,
  FakeTranscriber,
  NodeWavFileSink,
  ScriptedAppTransport,
  VOICE_NAMES,
  VoiceConversationHarness,
  type IAudioMonitor,
  type MonitorEvent,
} from '../src/index.js';

class RecordingMonitor implements IAudioMonitor {
  public readonly events: MonitorEvent[] = [];

  public onEvent(event: MonitorEvent): void {
    this.events.push(event);
  }
}

describe('WAV codec', () => {
  it('round-trips every voice within quantization error', async () => {
    for (const voice of VOICE_NAMES) {
      const clip = await new FakeSynthesizer(voice).synthesize('Hello.');
      const decoded = decodeWav(encodeWav(clip));
      expect(decoded.sampleRate).toBe(clip.sampleRate);
      expect(decoded.samples.length).toBe(clip.samples.length);
      for (let i = 0; i < clip.samples.length; i++) {
        expect(decoded.samples[i]).toBeCloseTo(clip.samples[i] as number, 4);
      }
    }
  });

  it('rejects non-WAV bytes loudly', () => {
    expect(() => decodeWav(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() =>
      decodeWav(encodeWav({ samples: new Float32Array(0), sampleRate: 16000 }).fill(0))
    ).toThrow();
  });
});

describe('harness monitor surface', () => {
  it('emits ordered events and attaches clips to the result', async () => {
    const synthesizer = new FakeSynthesizer('robot');
    const monitor = new RecordingMonitor();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new ScriptedAppTransport(synthesizer, ['Hi.']),
      monitor,
    });
    await harness.connect();
    try {
      const result = await harness.speak('Hello.', { timeoutMs: 5_000 });
      expect(monitor.events.map((e) => e.kind)).toEqual([
        'turn-started',
        'outbound-audio',
        'reply-audio',
        'transcript',
        'turn-finished',
      ]);
      expect(monitor.events[0]).toMatchObject({ turnIndex: 0, say: 'Hello.' });
      expect(result.outbound.samples.length).toBeGreaterThan(0);
      expect(result.reply?.samples.length).toBeGreaterThan(0);
      expect(result.heard).toBe('Hi.');
    } finally {
      await harness.disconnect();
    }
  });

  it('survives a throwing monitor without failing the turn', async () => {
    const synthesizer = new FakeSynthesizer();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new ScriptedAppTransport(synthesizer, ['Still fine.']),
      monitor: {
        onEvent: () => {
          throw new Error('monitor bug');
        },
      },
    });
    await harness.connect();
    try {
      const result = await harness.speak('Hello.', { timeoutMs: 5_000 });
      expect(result.heard).toBe('Still fine.');
    } finally {
      await harness.disconnect();
    }
  });

  it('logs through the console monitor without throwing', async () => {
    const synthesizer = new FakeSynthesizer();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new ScriptedAppTransport(synthesizer, ['Hey.']),
      monitor: new ConsoleAudioMonitor('[test]'),
    });
    await harness.connect();
    try {
      await harness.speak('Hello.', { timeoutMs: 5_000 });
    } finally {
      await harness.disconnect();
    }
  });
});

describe('NodeWavFileSink', () => {
  it('records audible WAVs and transcripts per turn', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'voice-harness-'));
    try {
      const synthesizer = new FakeSynthesizer('mlg');
      const sink = new NodeWavFileSink({ directory: dir });
      const harness = new VoiceConversationHarness({
        synthesizer,
        transcriber: new FakeTranscriber(),
        transport: new ScriptedAppTransport(synthesizer, ['Loud noises.']),
        monitor: sink,
      });
      await harness.connect();
      try {
        await harness.speak('Hello.', { timeoutMs: 5_000 });
      } finally {
        await harness.disconnect();
      }
      await sink.drain();
      const files = sink.getWrittenFiles();
      expect(files).toHaveLength(3);
      const outbound = files.find((f) => f.endsWith('outbound.wav'));
      const reply = files.find((f) => f.endsWith('reply.wav'));
      const heard = files.find((f) => f.endsWith('heard.txt'));
      expect(outbound).toBeDefined();
      expect(reply).toBeDefined();
      expect(heard).toBeDefined();
      const decoded = decodeWav(new Uint8Array(await readFile(outbound as string)));
      expect(decoded.samples.length).toBeGreaterThan(0);
      expect(await readFile(heard as string, 'utf8')).toBe('Loud noises.');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects an empty directory loudly', () => {
    expect(() => new NodeWavFileSink({ directory: '  ' })).toThrow();
  });
});
