# realtime-voice-harness

Text-in/text-out test harness for realtime voice apps with agentic harnesses. Speak with text, listen with text: the harness synthesizes each scripted line, pipes the audio into the app under test, records the audio reply, and transcribes it back for assertions.

## Status

Early development. Tests run headless with in-memory doubles; real TTS/STT/transport adapters are future work.

## Getting started

```
bun install
bun run test
```

## Layout

- `src/audio` — PCM audio value objects
- `src/speech` — synthesizer/transcriber driver contracts
- `src/transport` — realtime transport contract
- `src/harness` — scripted conversation driver
- `src/fakes` — in-memory doubles (no keys, no mic, no network)
- `tests` — end-to-end loop tests against the doubles

## Working on this

See `AGENTS.md` for the commands and conventions the agent follows.
