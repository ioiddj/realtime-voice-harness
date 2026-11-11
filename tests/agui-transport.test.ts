/**
 * @file agui-transport.test.ts — AguiSseTransport against a mock AG-UI SSE endpoint.
 * @module tests/agui-transport
 */
/// <reference types="node" />
import { createServer } from 'node:http';
import type {
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  FakeSynthesizer,
  FakeTranscriber,
  VoiceConversationHarness,
} from '../src/index.js';
import { AguiSseTransport } from '../src/transports/AguiSseTransport.js';

/** Starts an in-process HTTP server on an ephemeral port. */
function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<{ server: Server; url: string }> {
  const server: Server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port: number =
        typeof address === 'object' && address !== null ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${String(port)}` });
    });
  });
}

/** Reads the full request body as text. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error: Error) => {
      reject(error);
    });
  });
}

/** Writes one AG-UI event as an SSE frame. */
function writeEvent(res: ServerResponse, event: Record<string, string>): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** Closes the server, resolving when shut down. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error !== undefined) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe('AguiSseTransport', () => {
  it('runs the harness loop through a mock AG-UI SSE endpoint', async () => {
    let receivedBody = '';
    const { server, url } = await startServer((req, res) => {
      void (async (): Promise<void> => {
        receivedBody = await readBody(req);
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        writeEvent(res, {
          type: 'RUN_STARTED',
          threadId: 't-1',
          runId: 'r-1',
        });
        writeEvent(res, {
          type: 'TEXT_MESSAGE_START',
          messageId: 'm-1',
          role: 'assistant',
        });
        writeEvent(res, {
          type: 'STATE_SNAPSHOT',
          snapshot: '{}',
        });
        writeEvent(res, {
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'm-1',
          delta: 'Hello, ',
        });
        writeEvent(res, {
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'm-1',
          delta: 'human.',
        });
        writeEvent(res, { type: 'TEXT_MESSAGE_END', messageId: 'm-1' });
        writeEvent(res, {
          type: 'RUN_FINISHED',
          threadId: 't-1',
          runId: 'r-1',
        });
        res.end('data: [DONE]\n\n');
      })();
    });

    try {
      const synthesizer = new FakeSynthesizer();
      const transcriber = new FakeTranscriber();
      const transport = new AguiSseTransport({
        baseUrl: url,
        transcriber,
        synthesizer,
        threadId: 't-1',
        extraBody: {
          forwardedProps: { conversationId: 't-1', generationSettings: {} },
        },
      });
      const harness = new VoiceConversationHarness({
        synthesizer,
        transcriber,
        transport,
      });

      await harness.connect();
      try {
        const result = await harness.speak('Hello, agent.', {
          timeoutMs: 5_000,
        });
        expect(result.said).toBe('Hello, agent.');
        expect(result.heard).toBe('Hello, human.');
      } finally {
        await harness.disconnect();
      }

      const parsed = JSON.parse(receivedBody) as {
        messages?: Array<{ role?: string; content?: string }>;
        threadId?: string;
        forwardedProps?: { conversationId?: string };
      };
      expect(parsed.threadId).toBe('t-1');
      const first = parsed.messages?.[0];
      expect(first?.role).toBe('user');
      expect(first?.content).toBe('Hello, agent.');
      expect(parsed.forwardedProps?.conversationId).toBe('t-1');
    } finally {
      await closeServer(server);
    }
  });

  it('rejects with a plain Error on HTTP 500', async () => {
    const { server, url } = await startServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'boom' }));
    });

    try {
      const synthesizer = new FakeSynthesizer();
      const transcriber = new FakeTranscriber();
      const transport = new AguiSseTransport({
        baseUrl: url,
        transcriber,
        synthesizer,
      });
      await transport.connect();
      try {
        const outbound = await synthesizer.synthesize('Hi.');
        await expect(transport.sendAudio(outbound)).rejects.toThrow(
          /HTTP 500/
        );
      } finally {
        await transport.disconnect();
      }
    } finally {
      await closeServer(server);
    }
  });

  it('rejects with a plain Error on RUN_ERROR events', async () => {
    const { server, url } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      writeEvent(res, {
        type: 'RUN_STARTED',
        threadId: 't-1',
        runId: 'r-1',
      });
      writeEvent(res, { type: 'RUN_ERROR', message: 'model exploded' });
      res.end();
    });

    try {
      const synthesizer = new FakeSynthesizer();
      const transcriber = new FakeTranscriber();
      const transport = new AguiSseTransport({
        baseUrl: url,
        transcriber,
        synthesizer,
      });
      await transport.connect();
      try {
        const outbound = await synthesizer.synthesize('Hi.');
        await expect(transport.sendAudio(outbound)).rejects.toThrow(
          /model exploded/
        );
      } finally {
        await transport.disconnect();
      }
    } finally {
      await closeServer(server);
    }
  });
});
