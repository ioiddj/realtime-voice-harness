/**
 * @file voiceTools.ts — MCP toolkit exposing the harness to agents.
 * @module mcp/voiceTools
 *
 * Lets an agent run voice tests on itself (or on another app): the tools
 * below speak, listen, and script conversations through a
 * `VoiceConversationHarness`, returning transcripts and timings as JSON.
 * Transport-agnostic: wire fakes for unit checks, real adapters for
 * integration runs.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VOICE_NAMES } from '../fakes/VoicePresets.js';
import {
  VoiceConversationHarness,
  type HarnessDrivers,
} from '../harness/VoiceConversationHarness.js';

/** Options for {@link createVoiceMcpToolkit}. */
export interface VoiceMcpOptions {
  /** Harness drivers (synthesizer, transcriber, transport, optional monitor). */
  readonly drivers: HarnessDrivers;
  /** Server name advertised to clients. Defaults to `'voice-harness'`. */
  readonly name?: string;
  /** Server version advertised to clients. Defaults to `'0.1.0'`. */
  readonly version?: string;
}

/** A voice-testing MCP toolkit: the server plus harness lifecycle. */
export interface VoiceMcpToolkit {
  /** The MCP server. Connect a transport (`stdio`, in-memory, ...) to serve. */
  readonly server: McpServer;
  /** Disconnects the harness. Call when the toolkit is retired. */
  close(): Promise<void>;
}

/**
 * Creates an MCP toolkit driving one harness instance.
 * The harness connects lazily on the first tool call.
 * @param options - Harness drivers plus server identity.
 * @returns The toolkit (server + close).
 */
export function createVoiceMcpToolkit(
  options: VoiceMcpOptions
): VoiceMcpToolkit {
  const harness = new VoiceConversationHarness(options.drivers);
  let connected = false;
  const useHarness = async (): Promise<VoiceConversationHarness> => {
    if (!connected) {
      await harness.connect();
      connected = true;
    }
    return harness;
  };

  const server = new McpServer({
    name: options.name ?? 'voice-harness',
    version: options.version ?? '0.1.0',
  });

  server.registerTool(
    'voice_say',
    {
      description:
        'Speak one line to the app under test and hear its reply as text.',
      inputSchema: {
        text: z.string().describe('Line to synthesize and send.'),
        timeoutMs: z
          .number()
          .optional()
          .describe('Max wait for reply audio (default 30000).'),
      },
    },
    async ({ text, timeoutMs }) => {
      const active = await useHarness();
      const turn =
        timeoutMs === undefined
          ? await active.speak(text)
          : await active.speak(text, { timeoutMs });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              said: turn.said,
              heard: turn.heard,
              roundTripMs: turn.roundTripMs,
              timeToFirstAudioMs: turn.timeToFirstAudioMs,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    'voice_script',
    {
      description:
        'Run an ordered list of spoken lines; returns each turn transcript.',
      inputSchema: {
        turns: z
          .array(z.string())
          .describe('Lines to synthesize and send, in order.'),
      },
    },
    async ({ turns }) => {
      const active = await useHarness();
      const results = await active.runScript(turns.map((say) => ({ say })));
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              results.map((result) => ({
                said: result.said,
                heard: result.heard,
                roundTripMs: result.roundTripMs,
                timeToFirstAudioMs: result.timeToFirstAudioMs,
              }))
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    'voice_list',
    {
      description: 'List the synthetic voices available for tests.',
    },
    () =>
      Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ voices: VOICE_NAMES }),
          },
        ],
      })
  );

  return {
    server,
    close: async (): Promise<void> => {
      if (connected) {
        connected = false;
        await harness.disconnect();
      }
      await server.close();
    },
  };
}
