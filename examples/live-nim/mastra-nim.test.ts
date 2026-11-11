/**
 * @file mastra-nim.test.ts — Real Mastra agent on a real NIM model, live only.
 * @module examples/live-nim/mastra-nim
 *
 * Runs only with `NIM_LIVE_RUN=1` + `NVIDIA_NIM_API_KEY`; otherwise skips.
 * Proves the harness loop against a live provider-backed framework agent.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  LangChainTransport,
  mastraInvoke,
  VoiceConversationHarness,
} from 'realtime-voice-harness';
import { NIM_API_KEY, NIM_BASE_URL, NIM_LIVE_ENABLED, NIM_MODEL_ID } from './live-checks.js';

describe.skipIf(!NIM_LIVE_ENABLED)('Mastra voice loop (live NIM)', () => {
  it('hears a live Nemotron reply through the harness loop', async () => {
    const nim = createOpenAI({ baseURL: NIM_BASE_URL, apiKey: NIM_API_KEY });
    // The installed @ai-sdk/openai emits v4 models while Mastra pins its own
    // v4 variant: structurally distinct, runtime-compatible (verified live).
    type MastraModelOption = ConstructorParameters<
      typeof MastraAgent
    >[0]['model'];
    const agent = new Agent({
      name: 'live',
      id: 'live-nim',
      instructions: 'Follow instructions exactly.',
      model: nim.chat(NIM_MODEL_ID) as unknown as MastraModelOption,
    });
    const synthesizer = new FakeSynthesizer();
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber: new FakeTranscriber(),
      transport: new LangChainTransport({
        invoke: mastraInvoke(agent),
        transcriber: new FakeTranscriber(),
        synthesizer,
      }),
    });
    await harness.connect();
    try {
      const result = await harness.speak('Reply with exactly: NIM_MASTRA_LOOP_OK', {
        timeoutMs: 120_000,
      });
      expect(result.heard).toContain('NIM_MASTRA_LOOP_OK');
      expect(result.roundTripMs).toBeGreaterThan(0);
    } finally {
      await harness.disconnect();
    }
  }, 180_000);
});
