/**
 * @file AgentAdapters.ts — One-line adapters from agent frameworks to the
 * harness transport pipeline.
 * @module agents/AgentAdapters
 *
 * Each adapter narrows a framework agent to the plain
 * `(text: string) => Promise<string>` function `LangChainTransport` drives,
 * so every framework shares one tested send/transcribe/synthesize path.
 * Structural interfaces (not framework types) keep the harness decoupled
 * from framework versions: if it has the method, it works.
 */

/**
 * Minimal Mastra agent surface needed by the harness.
 * Satisfied by `Agent` from `@mastra/core/agent`.
 */
export interface MastraLikeAgent {
  /**
   * Runs the agent on text input.
   * @param input - User text.
   * @returns The agent result carrying reply text.
   */
  generate(input: string): Promise<{ text: string }>;
}

/**
 * Minimal VoltAgent surface needed by the harness.
 * Satisfied by `Agent` from `@voltagent/core`.
 */
export interface VoltAgentLikeAgent {
  /**
   * Runs the agent on text input.
   * @param input - User text.
   * @returns The agent response carrying reply text.
   */
  generateText(input: string): Promise<{ text: string }>;
}

/**
 * Adapts a Mastra-compatible agent to a harness invoke function.
 * @param agent - Agent (real `Agent` or any object with `generate`).
 * @returns Invoke function for `LangChainTransport`.
 */
export function mastraInvoke(
  agent: MastraLikeAgent
): (text: string) => Promise<string> {
  return (text: string): Promise<string> =>
    agent.generate(text).then((result) => result.text);
}

/**
 * Adapts a VoltAgent-compatible agent to a harness invoke function.
 * @param agent - Agent (real `Agent` or any object with `generateText`).
 * @returns Invoke function for `LangChainTransport`.
 */
export function voltAgentInvoke(
  agent: VoltAgentLikeAgent
): (text: string) => Promise<string> {
  return (text: string): Promise<string> =>
    agent.generateText(text).then((result) => result.text);
}
