/**
 * @file agui-nim.test.ts — Full loop vs a live AG-UI endpoint, live only.
 * @module examples/live-nim/agui-nim
 *
 * Runs only with `AGUI_BASE_URL` set (e.g. a local Innerview server on
 * `http://localhost:3099`, which needs its own NIM key configured).
 * Generation settings travel as top-level `extraBody` fields.
 */
import { describe, expect, it } from 'vitest';
import {
  AguiSseTransport,
  ConsoleAudioMonitor,
  FakeSynthesizer,
  FakeTranscriber,
  MlgVoice,
  NodeWavFileSink,
  VoiceConversationHarness,
  type IAudioMonitor,
} from 'realtime-voice-harness';
import { AGUI_BASE_URL, NIM_BASE_URL, NIM_MODEL_ID } from './live-checks.js';

describe.skipIf(AGUI_BASE_URL === null)('AG-UI voice loop (live endpoint)', () => {
  it('hears a live agent reply through the harness loop', async () => {
    const baseUrl = AGUI_BASE_URL as string;
    const threadId = `live-agui-${String(Date.now())}`;
    const synthesizer = new MlgVoice({ synthesizer: new FakeSynthesizer() });
    const consoleMonitor = new ConsoleAudioMonitor('[agui-nim]');
    const artifactSink = new NodeWavFileSink({
      directory: 'test-results/voice/agui-nim',
      onError: (error) => {
        console.error(`[agui-nim] artifact write failed: ${error.message}`);
      },
    });
    const monitor: IAudioMonitor = {
      onEvent: (event) => {
        consoleMonitor.onEvent(event);
        artifactSink.onEvent(event);
      },
    };
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      monitor,
      transport: new AguiSseTransport({
        baseUrl,
        transcriber: new FakeTranscriber(),
        synthesizer,
        chatPath: '/api/agui',
        threadId,
        extraBody: {
          conversationId: threadId,
          generationSettings: {
            baseURL: NIM_BASE_URL,
            modelName: NIM_MODEL_ID,
          },
        },
      }),
    });
    await harness.connect();
    try {
      const result = await harness.speak('Reply with exactly: AGUI_LOOP_OK', {
        timeoutMs: 120_000,
      });
      const passed = result.heard.includes('AGUI_LOOP_OK');
      console.log(
        `\n[AG-UI NIM] ${passed ? 'PASS' : 'FAIL'}\n` +
          `  said:           ${result.said}\n` +
          `  heard:          ${result.heard}\n` +
          `  expected:       AGUI_LOOP_OK\n` +
          `  first audio ms: ${String(result.timeToFirstAudioMs ?? 'silence')}\n` +
          `  round trip ms:  ${String(result.roundTripMs)}\n` +
          '  mode:           silent transcript report (no playback)'
      );
      expect(passed).toBe(true);
    } finally {
      await artifactSink.drain();
      console.log(
        `[AG-UI NIM] artifacts: ${artifactSink.getWrittenFiles().join(', ') || '(none)'}`
      );
      await harness.disconnect();
    }
  }, 180_000);
});
