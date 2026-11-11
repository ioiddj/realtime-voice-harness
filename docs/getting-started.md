# Getting started

## Prerequisites

- Node 22+ or Bun 1.4+
- No microphone, model keys, or network needed for the core loop

## Install and build

```sh
bun install
bun run build
```

`build` emits both `dist/esm` (for `import`) and `dist/cjs` (for `require`),
plus a `dist/cjs/package.json` marking that tree CommonJS. The package
self-links in this repo (`node_modules/realtime-voice-harness -> ..`), so
`examples/` import the built package by name exactly as external consumers do.

## Your first scripted conversation

```ts
import {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
  VoiceConversationHarness,
} from 'realtime-voice-harness';

// The synthesizer instance is shared: the app double renders its replies
// through it, and the harness renders its lines through it.
const synthesizer = new FakeSynthesizer();
const harness = new VoiceConversationHarness({
  synthesizer,
  transcriber: new FakeTranscriber(),
  transport: new ScriptedAppTransport(synthesizer, [
    'Hello, human.', // reply to turn 1 (last reply repeats)
  ]),
});

await harness.connect();
try {
  // One turn: synthesize -> send -> capture reply -> transcribe.
  const turn = await harness.speak('Hello, agent.');
  console.log(turn.said); // 'Hello, agent.'
  console.log(turn.heard); // 'Hello, human.'
  console.log(turn.roundTripMs); // ms from send to transcribed reply

  // A script: ordered turns, each with its own assertion.
  // expectReply may be sync or async; rejections fail the run.
  await harness.runScript([
    {
      say: 'First line.',
      expectReply: (reply) => {
        if (reply !== 'Hello, human.') {
          throw new Error(`unexpected reply: ${reply}`);
        }
      },
    },
  ]);
} finally {
  await harness.disconnect();
}
```

## Hearing the synthesized audio

Pass a monitor to hear exactly what a test said and heard. `NodeWavFileSink`
records every turn to `turn-<n>-outbound.wav` / `turn-<n>-reply.wav` plus a
`.txt` transcript — open them with any player (`ffplay`, Audacity):

```ts
const sink = new NodeWavFileSink({ directory: './voice-debug' });
const harness = new VoiceConversationHarness({ synthesizer, transcriber, transport, monitor: sink });
await harness.connect();
await harness.runScript([...]);
await harness.disconnect();
await sink.drain(); // wait for pending writes before asserting on files
```

`ConsoleAudioMonitor` logs one line per stage for live debugging, and every
`TurnResult` carries its `outbound`/`reply` clips for in-test inspection
(`encodeWav`/`decodeWav` convert clips to playable WAV bytes). Monitors are
best-effort: a throwing monitor never fails the turn it observes.

## Timeouts

`harness.speak(text, { timeoutMs })` waits up to `timeoutMs` (default 30_000)
for reply audio before resolving with an empty transcript. Keep suite timeouts
above it: a silent app costs you the full wait. `ScriptedAppTransport` with no
replies throws immediately instead — fail fast while scripting.

## Sessions

`new VoiceConversationHarness(drivers, session?)` accepts an opaque session
handle threaded through turns and readable via `getSession()`. Use it to carry
per-conversation state (e.g. an agent thread/memory id) in custom transports.

## Choosing a voice

`FakeSynthesizer` accepts a voice name — `default`, `mlg` (the infamous
bass-boosted MLG voiceover voice, airhorn blast included), `robot`, or
`whisper`. Every voice renders distinct samples but transcribes to the same
text, so multi-voice scripts assert on words, not waveforms:

```ts
const synthesizer = new FakeSynthesizer('mlg');
```

List them with `VOICE_NAMES`, narrow with `isFakeVoiceName`, and render
directly with `renderVoiceSamples` — all exported from the package root.

## Next steps

- Run the loop under your framework: [frameworks.md](frameworks.md)
- Test a real agent endpoint: [transports.md](transports.md)
- What's planned next: [roadmap.md](roadmap.md)
