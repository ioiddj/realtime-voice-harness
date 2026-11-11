/**
 * @file voice-harness.test.ts — Full harness loop through the LangChain transport.
 * @module examples/langchain/voice-harness
 */
import { RunnableLambda } from '@langchain/core/runnables';
import { describe, expect, it } from 'vitest';
import { FakeSynthesizer, FakeTranscriber, VoiceConversationHarness } from '../../src/index.js';
import { LangChainTransport } from '../../src/transports/LangChainTransport.js';

describe('LangChainTransport harness loop', () => {
  it('speaks text and hears the LangChain runnable reply as text', async () => {
    const echo = new RunnableLambda({
      func: (input: string): Promise<string> => Promise.resolve(`echo: ${input}`),
    });
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new LangChainTransport({
      invoke: (text: string): Promise<string> => echo.invoke(text),
      transcriber,
      synthesizer,
    });
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

    await harness.connect();
    try {
      const result = await harness.speak('Hello, chain.', {
        timeoutMs: 5_000,
      });
      expect(result.said).toBe('Hello, chain.');
      expect(result.heard).toBe('echo: Hello, chain.');
      expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
    } finally {
      await harness.disconnect();
    }
  });

  it('runs a scripted conversation through the runnable', async () => {
    const upper = new RunnableLambda({
      func: (input: string): Promise<string> => Promise.resolve(input.toUpperCase()),
    });
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new LangChainTransport({
      invoke: (text: string): Promise<string> => upper.invoke(text),
      transcriber,
      synthesizer,
    });
    const harness = new VoiceConversationHarness({
      synthesizer,
      transcriber,
      transport,
    });

    await harness.connect();
    try {
      const results = await harness.runScript([
        {
          say: 'first',
          expectReply: (reply) => {
            expect(reply).toBe('FIRST');
          },
        },
        {
          say: 'second',
          expectReply: (reply) => {
            expect(reply).toBe('SECOND');
          },
        },
      ]);
      expect(results).toHaveLength(2);
    } finally {
      await harness.disconnect();
    }
  });

  it('supports the text side channel', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const seen: string[] = [];
    const transport = new LangChainTransport({
      invoke: (text: string): Promise<string> => {
        seen.push(text);
        return Promise.resolve(`got:${text}`);
      },
      transcriber,
      synthesizer,
    });

    await transport.connect();
    try {
      const heard: string[] = [];
      const done = new Promise<void>((resolve) => {
        transport.onAudio((audio) => {
          heard.push(audio.tag ?? '');
          resolve();
        });
      });
      await transport.sendText('ping');
      await done;
      expect(seen).toEqual(['ping']);
      expect(heard).toEqual(['reply:got:ping']);
    } finally {
      await transport.disconnect();
    }
  });

  it('fails loudly when unconnected', async () => {
    const synthesizer = new FakeSynthesizer();
    const transcriber = new FakeTranscriber();
    const transport = new LangChainTransport({
      invoke: (text: string): Promise<string> => Promise.resolve(text),
      transcriber,
      synthesizer,
    });
    const clip = await synthesizer.synthesize('hi');
    await expect(transport.sendAudio(clip)).rejects.toThrow('not connected');
    await expect(transport.sendText('hi')).rejects.toThrow('not connected');
  });
});
