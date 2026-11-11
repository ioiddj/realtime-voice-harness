# TODO — carry-forward

## Done (attack proposals, implemented one commit each)

- [x] P0 multi-segment tag loss → first-tag rule on join + chunked test.
- [x] P1 silent timeouts → `SpeakOptions.onTimeout` (`'throw'` opt-in, docs recommend it).
- [x] P1 sink `onError` → optional hook on `NodeWavFileSink` (default silent).
- [x] P2 knownReplies docs → tag-key format in `getting-started.md` + JSDoc example.
- [x] P2 `reset()` on stateful doubles (`ScriptedAppTransport`,
  `FakeTanStackConnection`; the adapter itself is stateless).
- [x] P2 publish hygiene → `"prepack": "bun run build"` + `CHANGELOG.md`.

## Awaiting operator decisions (not work)

- **Push `origin/main`.** Done — public at
  `github.com/ioiddj/realtime-voice-harness`.
- **npm publish.** Blocked on `npm login` (registry: not-logged-in;
  `npm publish --dry-run` passes: 130 files, dist included). Run `npm login`,
  then `npm publish` from the repo root.
- **Mastra / VoltAgent.** Shipped (`mastraInvoke` / `voltAgentInvoke` +
  mock-model example suites + live NIM suites incl. full harness loops).
  Remaining: streaming replies, thread memory, voice providers (see roadmap).

## Unverified (could not be checked here)

- Midscene live `aiAssert` (needs model key + browsers; skips by design).
- `OpenAiRealtimeTransport` over the wire (reference only; needs live key).
