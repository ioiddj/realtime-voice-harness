# Roadmap

Targeting notes for agent frameworks not yet integrated, plus deferred work.
Anything marked **verify** is based on public docs, not installed packages —
confirm against the real API before building.

## Mastra

The `LangChainTransport` text-bridge pattern applies directly: wrap
`(text) => agent.generate(...).text` as `invoke` (**verify** method/result
shape) and reuse the transcribe → generate → synthesize → `onAudio` pipeline.
Further integration points, in order of value:

1. **Streaming replies** — if `agent.stream(...)` exists (**verify**), emit
   partial replies as multiple `AudioClip`s through `onAudio`.
2. **Thread memory** — carry the Mastra thread/resource id in the harness
   `TSession` generic so multi-turn scripts share agent memory.
3. **Voice providers** — if `@mastra/voice-*` providers exist and are stable
   (**verify**), subscribe raw audio events to `onAudio` / forward PCM to
   `sendAudio` and skip the STT/TTS doubles for a true realtime transport.
4. **Latency budget** — Mastra tools run server-side inside `generate()`;
   account for tool round-trips in `expectReply` via `timeoutMs`.

## VoltAgent

Same text-bridge entry: wrap the agent's text-generation call (believed to be
`agent.generateText(...)`, AI-SDK style — **verify**) as `invoke` in a
`VoltAgentTransport`. Then:

1. **Voice options** — if a `voice` agent option or `@voltagent/voice-*`
   packages exist (**verify**), wire provider audio deltas to `onAudio`.
2. **Supervisor graphs** — drive the top-level supervisor's text channel; the
   harness then covers whole-graph behavior per turn.
3. **Telemetry** — attach `TurnResult` (`said`/`heard`/`roundTripMs`) to
   VoltAgent's logger for harness-run traces (**verify** hook names).

## MCP toolkit server — built

`createVoiceMcpToolkit` (`src/mcp/voiceTools.ts`) exposes `voice_say`,
`voice_script`, and `voice_list` over any MCP transport (stdio for real
agents, in-memory in `tests/mcp-server.test.ts`). Reuses the harness
directly; the harness connects lazily on the first tool call.

## Publishing

Licensed MIT (`LICENSE`, holder `ioidj`), version `0.1.0`. `package.json`
stays `"private": true` until an explicit registry release is wanted — it
blocks `npm publish` while the public repo is source-only. Before that
release: flip `private` and add `"prepack": "bun run build"` so a published
tarball always contains a fresh `dist/`.
