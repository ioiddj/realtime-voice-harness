/** @file voice-harness.test.mjs — Voice harness loop example for node:test. @module examples/node/voice-harness */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

function createHarness() {
  const synthesizer = new FakeSynthesizer();
  const transcriber = new FakeTranscriber();
  const transport = new ScriptedAppTransport(synthesizer, [
    'Hello, human.',
    'Second reply.',
  ]);
  return new VoiceConversationHarness({ synthesizer, transcriber, transport });
}

describe('VoiceConversationHarness (node:test)', () => {
  it('speaks text and hears the app reply as text', async () => {
    const harness = createHarness();
    await harness.connect();
    try {
      const result = await harness.speak('Hello, agent.', {
        timeoutMs: 5000,
      });
      assert.equal(result.said, 'Hello, agent.');
      assert.equal(result.heard, 'Hello, human.');
      assert.ok(result.roundTripMs >= 0);
    } finally {
      await harness.disconnect();
    }
  });

  it('runs a scripted conversation with an async reply assertion', async () => {
    const harness = createHarness();
    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'Hello, agent.',
          expectReply: async (reply) => {
            assert.equal(reply, 'Hello, human.');
          },
        },
        {
          say: 'Second line.',
          expectReply: async (reply) => {
            assert.equal(reply, 'Second reply.');
          },
        },
      ]);
      assert.equal(results.length, 2);
    } finally {
      await harness.disconnect();
    }
  });
});
