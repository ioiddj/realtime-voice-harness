/**
 * @file validation.test.ts — Headless negative tests for the OpenAI Realtime reference transport.
 * @module examples/openai-realtime/validation
 */
import { describe, expect, it } from 'vitest';
import { FakeSynthesizer } from '../../src/index.js';
import { OpenAiRealtimeTransport } from '../../src/transports/OpenAiRealtimeTransport.js';

describe('OpenAiRealtimeTransport validation (no network)', () => {
  it('throws without an API key', () => {
    expect(() => new OpenAiRealtimeTransport({ apiKey: '' })).toThrow('non-empty apiKey');
  });

  it('applies model and voice defaults', () => {
    const transport = new OpenAiRealtimeTransport({ apiKey: 'test-key' });
    expect(transport.getModel()).toBe('gpt-4o-realtime-preview');
    expect(transport.getVoice()).toBe('alloy');
  });

  it('throws when sending while unconnected and performs no I/O', async () => {
    const transport = new OpenAiRealtimeTransport({ apiKey: 'test-key' });
    const synthesizer = new FakeSynthesizer();
    const clip = await synthesizer.synthesize('hello');
    await expect(transport.sendAudio(clip)).rejects.toThrow('not connected');
    await expect(transport.sendText('hello')).rejects.toThrow('not connected');
    await expect(transport.disconnect()).resolves.toBeUndefined();
  });

  it('supports listener subscribe/unsubscribe while unconnected', async () => {
    const transport = new OpenAiRealtimeTransport({ apiKey: 'test-key' });
    let calls = 0;
    const unsubscribe = transport.onAudio(() => {
      calls += 1;
    });
    unsubscribe();
    expect(calls).toBe(0);
    await transport.disconnect();
  });
});
