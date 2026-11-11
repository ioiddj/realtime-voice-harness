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

## MCP toolkit server — deferred

Decision: ship the library + docs first. An MCP server exposing
speak/listen/transcribe tools over stdio remains a reasonable next step once a
first consumer needs it; it should reuse `VoiceConversationHarness` directly
rather than reimplementing the loop.

## Publishing

`package.json` is currently `"private": true, "version": "0.0.0"` with no
license file. Before first publish or public announcement beyond the repo:
choose a license, flip `private`, and set a real version.
