# realtime-voice-harness

Text-in/text-out test harness for realtime voice apps with agentic harnesses.

Speak with text, listen with text: the harness synthesizes each scripted line,
pipes the audio into the app under test, records the audio reply, and
transcribes it back for assertions. No microphone, keys, or network required
for the loop itself — swap the in-memory doubles for real adapters when you
want the full path.

```ts
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

const synthesizer = new FakeSynthesizer();
const harness = new VoiceConversationHarness({
  synthesizer,
  transcriber: new FakeTranscriber(),
  transport: new ScriptedAppTransport(synthesizer, ['Hello, human.']),
});

await harness.connect();
try {
  const turn = await harness.speak('Hello, agent.');
  console.log(turn.heard); // 'Hello, human.'
} finally {
  await harness.disconnect();
}
```

## Status

Early development. The core loop, three transports, and six framework suites
are implemented and executed in CI-equivalent runs here (see
[Testing](#testing)). The OpenAI Realtime transport is a reference
implementation (needs a live key; never executed here). Mastra/VoltAgent
targets and the MCP toolkit server are roadmap items, not code.

## Install

```sh
bun install
bun run build
```

Node 22+, Bun 1.4+. Ships ESM (`dist/esm`) and CommonJS (`dist/cjs`) so both
`import` and `require` consumers — including jest/Playwright CJS transforms —
resolve the package by name.

## Layout

```text
src/
  audio/         PCM audio value objects
  speech/        synthesizer/transcriber driver contracts
  transport/     realtime transport contract
  transports/    concrete transports (AG-UI SSE, LangChain, OpenAI Realtime)
  harness/       scripted conversation driver
  fakes/         in-memory doubles (no keys, mic, or network)
tests/           unit + transport tests (vitest)
examples/        per-framework suites, each actually executed (see below)
docs/            rigorous documentation
```

`src/index.ts` is the public API — import from here, never from internals.

## Testing

Every suite below is executed, not just documented. Run everything with:

```sh
bun run test:examples   # build + all framework/agent suites
```

| Suite | Runner | Command | Status |
|---|---|---|---|
| Unit + transports (tests/) | vitest | `bun run test` | 39/39 pass |
| bun example | bun:test | `bun run test:bun` | 2/2 pass |
| node example | node:test | `bun run test:node` | 2/2 pass |
| jest example | jest (@swc/jest) | `bun run test:jest` | 2/2 pass |
| Playwright example | @playwright/test | `bun run test:playwright` | 2/2 pass, no browser launched |
| Local speech (transformers.js) | vitest | `bun run test:local-speech` | 3/3 pass, first run downloads models |
| LangChain transport | vitest | `bun run test:langchain` | 4/4 pass |
| TanStack transport (+ example) | vitest | `bun run test` + `bun run test:tanstack` | 5 + 2 pass |
| OpenAI Realtime validation | vitest | `bun run test:openai-realtime` | 4/4 pass (negative tests only) |
| midscene | @playwright/test + @midscene/web | `bun run test:midscene` | 2 pass, 1 skip (needs `MIDSCENE_MODEL_API_KEY`) |

Details and per-framework notes: [docs/frameworks.md](docs/frameworks.md).

## Transports

| Transport | Target | Verified |
|---|---|---|
| `ScriptedAppTransport` (fakes) | In-memory scripted app | Unit tests |
| `AguiSseTransport` | Any AG-UI SSE endpoint (e.g. Innerview `/api/chat`) | Mock-SSE tests + live check vs Innerview mock server |
| `LangChainTransport` | Any `(text) => Promise<string>` fn (`RunnableLambda`, executor) | Tests with echo/uppercase runnables |
| `TanStackTransport` | Any `@tanstack/ai` `RealtimeAdapter` (provider adapters, cascade adapters, `FakeTanStackAdapter`) | Tests over the fake; live provider needs keys |
| `OpenAiRealtimeTransport` | OpenAI Realtime WebSocket | Reference only — constructor/connect validation tests; never executed live |

Writing your own: [docs/transports.md](docs/transports.md).

## Docs

- [docs/getting-started.md](docs/getting-started.md) — install, first script, timeouts
- [docs/frameworks.md](docs/frameworks.md) — framework matrix, CJS/ESM notes, midscene keys
- [docs/transports.md](docs/transports.md) — transport contract, adapter guide, AG-UI protocol notes
- [docs/roadmap.md](docs/roadmap.md) — Mastra/VoltAgent targeting notes, MCP decision

## Working on this

See [AGENTS.md](AGENTS.md) for commands, conventions, and the verification
battery that must pass before a change counts as done.
