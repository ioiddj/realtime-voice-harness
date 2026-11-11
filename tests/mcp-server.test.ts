/**
 * @file mcp-server.test.ts — MCP toolkit over in-memory transport (no I/O).
 * @module tests/mcp-server
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import {
  createVoiceMcpToolkit,
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
} from '../src/index.js';

interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

function readText(result: unknown): string {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('content' in result)
  ) {
    throw new Error('MCP tool returned no content blocks.');
  }
  const content: unknown = result.content;
  if (!Array.isArray(content)) {
    throw new Error('MCP tool returned no content blocks.');
  }
  const block = content.find(
    (entry): entry is TextBlock =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { type?: unknown }).type === 'text' &&
      typeof (entry as { text?: unknown }).text === 'string'
  );
  if (block === undefined) {
    throw new Error('MCP tool returned no text block.');
  }
  return block.text;
}

describe('voice MCP toolkit', () => {
  it('speaks and hears through voice_say', async () => {
    const synthesizer = new FakeSynthesizer();
    const toolkit = createVoiceMcpToolkit({
      drivers: {
        synthesizer,
        transcriber: new FakeTranscriber(),
        transport: new ScriptedAppTransport(synthesizer, ['Hello, human.']),
      },
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await toolkit.server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const raw = await client.callTool({
        name: 'voice_say',
        arguments: { text: 'Hello, agent.' },
      });
      const heard = (JSON.parse(readText(raw)) as { heard: string }).heard;
      expect(heard).toBe('Hello, human.');
    } finally {
      await client.close();
      await toolkit.close();
    }
  });

  it('runs scripts and lists voices', async () => {
    const synthesizer = new FakeSynthesizer();
    const toolkit = createVoiceMcpToolkit({
      drivers: {
        synthesizer,
        transcriber: new FakeTranscriber(),
        transport: new ScriptedAppTransport(synthesizer, [
          'First reply.',
          'Second reply.',
        ]),
      },
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await toolkit.server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    try {
      const scripted = await client.callTool({
        name: 'voice_script',
        arguments: { turns: ['One.', 'Two.'] },
      });
      const turns = JSON.parse(readText(scripted)) as Array<{
        heard: string;
      }>;
      expect(turns.map((turn) => turn.heard)).toEqual([
        'First reply.',
        'Second reply.',
      ]);
      const listed = await client.callTool({ name: 'voice_list', arguments: {} });
      const voices = JSON.parse(readText(listed)) as { voices: string[] };
      expect(voices.voices).toContain('mlg');
    } finally {
      await client.close();
      await toolkit.close();
    }
  });
});
