/**
 * @file tanstack-transport.test.ts — TanStack transport loop over the fake adapter.
 * @module tests/tanstack-transport
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeToken,
  FakeTanStackAdapter,
  FakeTanStackConnection,
} from '../src/fakes/FakeTanStackAdapter.js';
import {
  FakeSynthesizer,
  FakeTranscriber,
} from '../src/fakes/FakeDoubles.js';
import { TanStackTransport } from '../src/transports/TanStackTransport.js';
import { VoiceConversationHarness } from '../src/index.js';

function createHarness(replies: readonly string[]): {
  harness: VoiceConversationHarness;
  transport: TanStackTransport;
} {
  const synthesizer = new FakeSynthesizer();
  const transcriber = new FakeTranscriber();
  const transport = new TanStackTransport({
    adapter: new FakeTanStackAdapter(replies),
    getToken: () => Promise.resolve(createFakeToken()),
    transcriber,
    synthesizer,
  });
  const harness = new VoiceConversationHarness({
    synthesizer,
    transcriber,
    transport,
  });
  return { harness, transport };
}

describe('TanStackTransport', () => {
  it('speaks text and hears the adapter reply as text', async () => {
    const { harness } = createHarness(['Hello, human.']);
    await harness.connect();
    try {
      const result = await harness.speak('Hello, agent.', {
        timeoutMs: 5_000,
      });
      expect(result.said).toBe('Hello, agent.');
      expect(result.heard).toBe('Hello, human.');
      expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
    } finally {
      await harness.disconnect();
    }
  });

  it('runs a scripted conversation through the adapter', async () => {
    const { harness } = createHarness(['First reply.', 'Second reply.']);
    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'First line.',
          expectReply: (reply) => {
            expect(reply).toBe('First reply.');
          },
        },
        {
          say: 'Second line.',
          expectReply: (reply) => {
            expect(reply).toBe('Second reply.');
          },
        },
      ]);
      expect(results).toHaveLength(2);
    } finally {
      await harness.disconnect();
    }
  });

  it('rejects sends while unconnected and double-connects', async () => {
    const { harness, transport } = createHarness(['Hi.']);
    await expect(
      transport.sendAudio({
        samples: new Float32Array(1),
        sampleRate: 16000,
      })
    ).rejects.toThrow('not connected');
    await harness.connect();
    try {
      await expect(harness.connect()).rejects.toThrow('already connected');
    } finally {
      await harness.disconnect();
    }
  });

  it('fails loudly when no replies are scripted', async () => {
    const connection = new FakeTanStackConnection([]);
    expect(() => {
      connection.sendText('Hello.');
    }).toThrow('no scripted replies');
    await connection.disconnect();
  });

  it('returns a defensive copy from getSession', () => {
    const connection = new FakeTanStackConnection(['Hi.']);
    connection.updateSession({ voice: 'alloy' });
    const snapshot = connection.getSession();
    expect(snapshot.voice).toBe('alloy');
    snapshot.voice = 'mutated';
    expect(connection.getSession().voice).toBe('alloy');
  });

  it('restarts scripted replies after reset', async () => {
    const heard: string[] = [];
    const connection = new FakeTanStackConnection(['One.', 'Two.']);
    connection.on('message_complete', (payload) => {
      const part = payload.message.parts[0];
      if (part !== undefined && part.type === 'text') {
        heard.push(part.content);
      }
    });
    connection.sendText('a');
    await new Promise((resolve) => setTimeout(resolve, 10));
    connection.reset();
    connection.sendText('b');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(heard).toEqual(['One.', 'One.']);
    await connection.disconnect();
  });
});
