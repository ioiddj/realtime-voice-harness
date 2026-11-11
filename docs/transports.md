# Transports

A transport is the app-under-test side of the loop. It implements
`IRealtimeTransport`:

- `connect()` / `disconnect()` — session lifecycle
- `sendAudio(audio: AudioClip)` — deliver a synthesized utterance
- `onAudio(listener)` — receive reply segments (returns unsubscribe)
- `sendText?(text)` — optional side channel for text-capable apps

The harness never sees audio semantics: it synthesizes, sends, captures, and
transcribes. Everything app-specific lives in the transport.

## Built-in transports

### `AguiSseTransport` — AG-UI SSE endpoints

Talks to any agent endpoint that accepts `{ messages, threadId }` JSON and
streams AG-UI server-sent events (e.g. Innerview's `/api/chat`). Because the
endpoint speaks text, the transport bridges both directions with the injected
drivers: outbound audio is transcribed to text, inbound `TEXT_MESSAGE_CONTENT`
deltas are accumulated and synthesized back to an `AudioClip`.

```ts
const transport = new AguiSseTransport({
  baseUrl: 'http://localhost:3002',
  transcriber, // ISpeechTranscriber
  synthesizer, // ISpeechSynthesizer
  threadId: 'live-test-1',
  chatPath: '/api/chat', // default
});
```

`parseAguiSseText(body)` is exported for reuse/testing: it accumulates text
deltas, skips lifecycle frames (`RUN_STARTED`, `RUN_FINISHED`,
`STATE_SNAPSHOT`, `[DONE]`), and throws on `RUN_ERROR`. Verified against a
mock SSE server (`tests/agui-transport.test.ts`) and live against Innerview
with `MOCK_LLM=1` (47 ms round trip; mock path, not a real provider).

### `LangChainTransport` — in-process agents

Wraps any `(text: string) => Promise<string>` function — a `RunnableLambda`,
an executor, a plain echo in tests:

```ts
import { RunnableLambda } from '@langchain/core/runnables';

const runnable = new RunnableLambda({
  func: (text: string) => Promise.resolve(`echo: ${text}`),
});
const transport = new LangChainTransport({
  invoke: (text) => runnable.invoke(text),
  transcriber,
  synthesizer,
});
```

Accepting a plain function (not a LangChain type) avoids version coupling; see
`examples/langchain/voice-harness.test.ts`.

### `OpenAiRealtimeTransport` — reference only

Shape-complete adapter over the OpenAI Realtime WebSocket API using only the
global `WebSocket` (no new dependencies). The constructor requires an API key
and throws without one. It is **not executed here** — no live key, no network
— and PCM16/base64 audio boundaries are marked TODO in the source. Covered by
negative validation tests (`examples/openai-realtime/validation.test.ts`).
Treat it as a starting point, not a working integration.

## Writing a custom transport

1. Implement `IRealtimeTransport` in `src/transports/YourTransport.ts`
   (house style: JSDoc `@file` header, explicit return types, no `any`).
2. Keep I/O behind constructor-injected interfaces; throw plain `Error`s with
   endpoint/status/body context on failure.
3. Export it from `src/index.ts`.
4. Prove it: a vitest file under `tests/` (mock the far side in-process) and,
   if it fits a runner, an example under `examples/<name>/` wired into
   `test:examples` (see [frameworks.md](frameworks.md)).
