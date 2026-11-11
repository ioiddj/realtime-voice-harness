/**
 * @file agui-nim.test.ts — Full loop vs a live AG-UI endpoint, live only.
 * @module examples/live-nim/agui-nim
 *
 * Runs only with `AGUI_BASE_URL` set (e.g. a local Innerview server on
 * `http://localhost:3099`, which needs its own NIM key configured).
 * Generation settings travel via `extraBody.forwardedProps`.
 */
import { describe, expect, it } from 'vitest';
import {
  AguiSseTransport,
  FakeSynthesizer,
  FakeTranscriber,
  VoiceConversationHarness,
} from 'realtime-voice-harness';
import { AGUI_BASE_URL, NIM_BASE_URL, NIM_MODEL_ID } from './live-checks.js';

describe.skipIf(AGUI_BASE_URL === null)('AG-UI voice loop (live endpoint)', () => {
  it('hears a live agent reply through the harness loop', async () => {
    const baseUrl = AGUI_BASE_URL as string;
    const threadId = `live-agui-${String(Date.now())}`;
    const synthesizer = new FakeSynthesizer();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new AguiSseTransport({
        baseUrl,
        transcriber: new FakeTranscriber(),
        synthesizer,
        threadId,
        extraBody: {
          forwardedProps: {
            conversationId: threadId,
            generationSettings: {
              baseURL: NIM_BASE_URL,
              modelName: NIM_MODEL_ID,
            },
          },
        },
      }),
    });
    await harness.connect();
    try {
      const result = await harness.speak('Reply with exactly: AGUI_LOOP_OK', {
        timeoutMs: 120_000,
      });
      expect(result.heard).toContain('AGUI_LOOP_OK');
    } finally {
      await harness.disconnect();
    }
  }, 180_000);
});
