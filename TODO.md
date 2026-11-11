# TODO — carry-forward (close pass 2026-11-11)

Nothing here is a surprise: each item was seen this session, sized, and left
open on purpose. Implement on operator word; each lands as its own commit
with the battery re-run.

## Proposed (attack findings, approved to implement on word)

- **P0 — multi-segment replies transcribe as `[unrecognized]`.** Routed to
  `/fix` with repro: drive any transport emitting 2 clips per reply through
  `VoiceConversationHarness.speak` (`/tmp/opencode/a-multiseg.ts` pattern);
  `waitForReply` joins via `concatClips`, which drops tags. Proposed fix:
  optional `{ tag }` on `concatClips`, reattach first clip's tag on join,
  plus a two-segment double test.
- **P1 — silent `speak()` timeouts.** Opt-in `options.onTimeout: 'throw' |
  'empty'` (default `'empty'`, zero behavior change); recommend `'throw'`
  in docs.
- **P1 — `NodeWavFileSink` fails silently.** Optional `onError?: (error:
  Error) => void` in `WavSinkOptions` (default: silent, current behavior).
- **P2 — `knownReplies` key format undocumented.** Document `say:<voice>:<text>`
  (+ legacy `say:<text>`) in `getting-started.md` + `FakeTranscriber` JSDoc.
- **P2 — scripted doubles can't reset.** Additive `reset()` on
  `ScriptedAppTransport`, `FakeTanStackAdapter`, `FakeTanStackConnection`.
- **P2 — publish hygiene.** `"prepack": "bun run build"`; `CHANGELOG.md`
  seeded from git log.

## Awaiting operator decisions (not work)

- **Push `origin/main`.** Remote set, 7 local commits, never pushed. Say the word.
- **npm publish.** Needs `private: false` + explicit go-ahead (see
  `docs/roadmap.md` → Publishing).
- **Mastra / VoltAgent / MCP server.** Roadmap notes only; unapproved.

## Unverified (could not be checked here)

- Midscene live `aiAssert` (needs model key + browsers; skips by design).
- `OpenAiRealtimeTransport` over the wire (reference only; needs live key).
- Mastra/VoltAgent API shapes (roadmap `**verify**` flags stand).
