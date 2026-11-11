/**
 * @file voice-harness.spec.ts — Voice loop example with a Midscene AI-assertion plug-in point.
 * @module examples/midscene/voice-harness
 *
 * The deterministic tests below drive the full voice loop (fake synthesizer,
 * fake transcriber, scripted app) with plain Playwright `expect` — no model
 * key, browser, or network required.
 *
 * The final test shows where a Midscene AI assertion plugs in: it extends the
 * Playwright test with `PlaywrightAiFixture` (from `@midscene/web/playwright`,
 * verified against that package's `dist/types/playwright/*.d.ts`) so the
 * `aiAssert` fixture is available, renders the transcribed reply into a page,
 * and asserts on it with `aiAssert(assertion)`. It runs only when
 * `MIDSCENE_LIVE_RUN=1` is set AND a model key is present
 * (`MIDSCENE_MODEL_API_KEY` or `OPENAI_API_KEY`); otherwise it skips and the
 * suite stays green. A live run also needs a browser
 * (`playwright install chromium`).
 */
import { expect, test as baseTest } from '@playwright/test';
import {
  PlaywrightAiFixture,
  type PlayWrightAiFixtureType,
} from '@midscene/web/playwright';
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
  type HarnessDrivers,
} from 'realtime-voice-harness';

const test = baseTest.extend<PlayWrightAiFixtureType>(PlaywrightAiFixture());

const REPLY_TIMEOUT_MS = 5_000;
const LIVE_RUN_ENV = 'MIDSCENE_LIVE_RUN';

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

/**
 * Reports whether a live Midscene run was requested and keyed.
 * @returns True when MIDSCENE_LIVE_RUN=1 and a model key is set.
 */
function isLiveRunEnabled(): boolean {
  const flag = process.env[LIVE_RUN_ENV] === '1';
  const key =
    process.env['MIDSCENE_MODEL_API_KEY'] ?? process.env['OPENAI_API_KEY'];
  return flag && key !== undefined && key.length > 0;
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

test.describe('live midscene ai assertion', () => {
  test.skip(
    !isLiveRunEnabled(),
    `Set ${LIVE_RUN_ENV}=1 with MIDSCENE_MODEL_API_KEY (or OPENAI_API_KEY) and ` +
      'a Playwright browser installed for the live Midscene AI assertion.',
  );

  test('aiAssert over the transcribed reply', async ({
    page,
    aiAssert,
  }): Promise<void> => {
    const { harness } = createHarness(['Your order is confirmed.']);
    await harness.connect();
    try {
      const result = await harness.speak('Did my order go through?', {
        timeoutMs: REPLY_TIMEOUT_MS,
      });
      await page.setContent(
        `<main><p data-testid="voice-reply">${result.heard}</p></main>`,
      );
      await aiAssert(
        `the page shows the voice reply "${result.heard}" in the voice-reply paragraph`,
      );
    } finally {
      await harness.disconnect();
    }
  });
});
