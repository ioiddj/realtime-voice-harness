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

- **Push `origin/main`.** Remote set, local commits, never pushed. Say the word.
- **npm publish.** Needs `private: false` + explicit go-ahead (see
  `docs/roadmap.md` → Publishing).
- **Mastra / VoltAgent / MCP server.** Roadmap notes only; unapproved.

## Unverified (could not be checked here)

- Midscene live `aiAssert` (needs model key + browsers; skips by design).
- `OpenAiRealtimeTransport` over the wire (reference only; needs live key).
- Mastra/VoltAgent API shapes (roadmap `**verify**` flags stand).
