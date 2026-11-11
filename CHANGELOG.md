# Changelog

All notable changes to `realtime-voice-harness`, newest first. Unreleased
changes pile at the top until the next version bump.

## Unreleased

- `AguiSseTransport` accepts `extraBody` (e.g. `forwardedProps`).
- Mastra/VoltAgent adapters (`mastraInvoke`, `voltAgentInvoke`) with mock-model
  example suites; live NIM suites under `examples/live-nim/` (skip without keys).

- Turn-level latency SLOs: `timeToFirstAudioMs` on every turn,
  `LatencyBudget` + `assertLatency`.
- First-party local speech: Supertonic TTS + Whisper STT via
  transformers.js (no keys; live-verified end to end).
- MCP toolkit: `voice_say` / `voice_script` / `voice_list` over any
  transport (`createVoiceMcpToolkit`).
- Fix: multi-segment replies keep the first clip's tag through `concatClips`,
  so chunked transports transcribe instead of yielding `[unrecognized]`.
- `SpeakOptions.onTimeout`: opt-in `'throw'` on silent turns (default
  `'empty'`, unchanged behavior).
- `NodeWavFileSink`: optional `onError` for write failures (default silent).
- `reset()` on `ScriptedAppTransport` and `FakeTanStackConnection` for reuse
  across tests.
- `bunfig.toml` scopes bare `bun test` to `examples/bun` (Playwright specs no
  longer leak into the wrong runner).
- Docs: `knownReplies` tag-key format, "Hearing the synthesized audio",
  "Choosing a voice", corrected test-matrix counts.

## 0.1.0 — 2026-11-11

- MIT license; versioned release baseline.
- TanStack AI first-class: `TanStackTransport` + `FakeTanStackAdapter`
  (CJS-safe, type-only coupling to `@tanstack/ai`).
- Audible debugging: monitor events, WAV codec, `NodeWavFileSink`, turn clips.
- Selectable fake voices incl. the MLG voiceover voice.
- Framework suites: jest, Playwright, bun:test, node:test, midscene;
  LangChain and OpenAI Realtime examples.
- AG-UI SSE transport with mock-server tests.
- Dual ESM+CJS build, self-link imports, `tsgo` typecheck, zero-warning lint.
