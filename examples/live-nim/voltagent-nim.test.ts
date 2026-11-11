/**
 * @file voltagent-nim.test.ts — Real VoltAgent on a real NIM model, live only.
 * @module examples/live-nim/voltagent-nim
 *
 * Runs only with `NIM_LIVE_RUN=1` + `NVIDIA_NIM_API_KEY`; otherwise skips.
 * VoltAgent's bundled AI SDK accepts v2/v3 models while the current
 * `@ai-sdk/openai` provider emits v4, so this suite drives NIM through the
 * test-only `createNimV2Model` helper (see `nim-v2-model.ts`).
 */
import { Agent } from '@voltagent/core';
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  LangChainTransport,
  voltAgentInvoke,
  VoiceConversationHarness,
} from 'realtime-voice-harness';
import { NIM_API_KEY, NIM_BASE_URL, NIM_LIVE_ENABLED, NIM_MODEL_ID } from './live-checks.js';
import { createNimTestModel } from './nim-test-model.js';

describe.skipIf(!NIM_LIVE_ENABLED)('VoltAgent voice loop (live NIM)', () => {
  it('hears a live Nemotron reply through the harness loop', async () => {
    const agent = new Agent({
      name: 'live',
      instructions: 'Follow instructions exactly.',
      model: createNimTestModel({
        baseUrl: NIM_BASE_URL,
        apiKey: NIM_API_KEY,
        modelId: NIM_MODEL_ID,
      }),
      maxRetries: 0,
    });
    const synthesizer = new FakeSynthesizer();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new LangChainTransport({
        invoke: voltAgentInvoke(agent),
        transcriber: new FakeTranscriber(),
        synthesizer,
      }),
    });
    await harness.connect();
    try {
      const result = await harness.speak('Reply with exactly: NIM_VOLT_LOOP_OK', {
        timeoutMs: 120_000,
      });
      expect(result.heard).toContain('NIM_VOLT_LOOP_OK');
      expect(result.roundTripMs).toBeGreaterThan(0);
    } finally {
      await harness.disconnect();
    }
  }, 180_000);
});
