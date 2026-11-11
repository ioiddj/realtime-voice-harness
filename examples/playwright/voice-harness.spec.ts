/** @file voice-harness.spec.ts — Voice loop example under Playwright (pure logic, no browser launched). @module examples/playwright/voice-harness */
import { expect, test } from '@playwright/test';
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
  type HarnessDrivers,
} from 'realtime-voice-harness';

const REPLY_TIMEOUT_MS = 5_000;

/** Voice-loop fixture: in-memory doubles wired into the harness. */
interface VoiceHarnessFixture {
  readonly harness: VoiceConversationHarness;
}

/**
 * Builds a harness backed by fake speech drivers and a scripted app.
 * @param replies - Canned app replies, consumed in order (last repeats).
 * @returns Harness fixture ready to connect.
 */
function createHarness(replies: readonly string[]): VoiceHarnessFixture {
  const synthesizer = new FakeSynthesizer();
  const transcriber = new FakeTranscriber();
  const transport = new ScriptedAppTransport(synthesizer, replies);
  const drivers: HarnessDrivers = { synthesizer, transcriber, transport };
  const harness = new VoiceConversationHarness(drivers);
  return { harness };
}

test('speaks text and hears the app reply as text', async (): Promise<void> => {
  const { harness } = createHarness(['Hello, human.']);
  await harness.connect();
  try {
    const result = await harness.speak('Hello, agent.', {
      timeoutMs: REPLY_TIMEOUT_MS,
    });
    expect(result.said).toBe('Hello, agent.');
    expect(result.heard).toBe('Hello, human.');
    expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
  } finally {
    await harness.disconnect();
  }
});

test('runs a scripted conversation with async reply assertions', async (): Promise<void> => {
  const { harness } = createHarness(['First reply.', 'Second reply.']);
  await harness.connect();
  try {
    const results = await harness.runScript([
      {
        say: 'First line.',
        expectReply: (reply: string): Promise<void> => {
          expect(reply).toBe('First reply.');
          return Promise.resolve();
        },
      },
      {
        say: 'Second line.',
        expectReply: (reply: string): Promise<void> => {
          expect(reply).toBe('Second reply.');
          return Promise.resolve();
        },
      },
    ]);
    expect(results).toHaveLength(2);
    const second = results[1] as (typeof results)[number];
    expect(second.heard).toBe('Second reply.');
  } finally {
    await harness.disconnect();
  }
});
