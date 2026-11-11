# Framework support

The library is framework-agnostic by construction:

- `src/` has **zero test-framework imports** (vitest appears only in `tests/`
  and agent examples).
- `speak()`/`runScript()` return plain data (`TurnResult`); failures are plain
  `Error`s. Any assertion library consumes them.
- `ScriptedTurn.expectReply` is `(reply: string) => void | Promise<void>`, so
  sync matchers (vitest/jest/bun/node `assert`) and async matchers
  (Playwright `expect` polling, midscene `aiAssert`) both fit.

Every suite below is executed via `bun run test:examples` (which builds first,
so examples test the shipped `dist/`, not `src/`).

## Matrix

| Framework | Dir | Import style | Notes |
|---|---|---|---|
| vitest 5 | `tests/`, `examples/langchain`, `examples/openai-realtime` | ESM package name | Unit + transport + agent suites |
| bun:test | `examples/bun` | ESM package name | Needs `/// <reference types="bun-types" />` for lint (see below) |
| node:test | `examples/node` (`*.test.mjs`) | ESM package name | `node:test` + `node:assert/strict`, no build step beyond `dist/` |
| jest 29 | `examples/jest` | CJS package name (`require` condition → `dist/cjs`) | `@swc/jest` transform; `jest.config.cjs` confines `roots`/`testMatch` |
| Playwright | `examples/playwright` | CJS package name | Pure-logic spec, no `page` fixture, no browser launched |
| midscene | `examples/midscene` | CJS package name | Deterministic loop runs; AI assertion skips without a key (see below) |

## ESM/CJS packaging

`package.json` exports both conditions:

```json
"exports": {
  ".": {
    "types": "./dist/esm/index.d.ts",
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

ESM runners (vitest, bun, node) take `import`; CJS transforms (jest via
@swc/jest, Playwright's babel pipeline) take `require` into `dist/cjs`, which
carries its own `package.json` with `{"type": "commonjs"}` so it loads
correctly under the root `"type": "module"`.

## Linting examples

`tsconfig.json` covers `src/` + `tests/`; `tsconfig.examples.json` covers
`examples/` (checked by `bun run typecheck`, which runs both). ESLint uses
`typescript-eslint` project-service mode, which only auto-discovers
`tsconfig.json` — so `eslint.config.js` lists every examples subdir in
`allowDefaultProject` (one-level globs; `**` is disallowed there). When adding
an examples subdir, add its entry. `require-await` is off for
`*.test.ts`/`*.spec.ts`: async test callbacks without `await` are idiomatic.

The bun example also needs `/// <reference types="bun-types" />` because
`bun:test` types don't flow through the default lint project.

## midscene

`examples/midscene/voice-harness.spec.ts` runs the deterministic loop (2
tests, no model, no browser) plus a live `aiAssert` block over the transcribed
reply rendered into a page. The live block runs only when
`MIDSCENE_LIVE_RUN=1` and a model key (`MIDSCENE_MODEL_API_KEY` or
`OPENAI_API_KEY`) is set; otherwise it skips at the `describe` level so no
fixtures instantiate and no browser launches. A live run additionally needs
Playwright browsers (`bunx playwright install chromium`) and the `@midscene/web`
package (already a devDependency).

## Adding a framework

1. Create `examples/<name>/` with the loop from [getting-started](getting-started.md).
2. Import the library by package name (`realtime-voice-harness`), never by
   relative path into `src/` or `dist/`.
3. Add a `test:<name>` script to `package.json` and append it to `test:examples`.
4. Add the dir to `allowDefaultProject` in `eslint.config.js` and to
   `tsconfig.examples.json`'s include if it holds `.ts` files.
5. Execute it here and record the result in the README matrix.
