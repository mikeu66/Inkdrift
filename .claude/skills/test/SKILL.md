---
name: test
description: Run and extend InkDrift's unit test suite (node:test over lib/)
---

# Testing InkDrift

## Running

```bash
npm test                                  # all suites (= node --test test/*.test.js)
node --test test/validate-todos.test.js   # a single file
```

Pure Node — no Electron, no browser, runs in ~50ms. The glob is expanded by
the shell, so `npm test` needs a shell (fine everywhere including CI, which
runs the same command on Node 22 via `.github/workflows/test.yml`). Passing
a *directory* to `node --test` broke on Node 22 — always pass files.

## What's covered / not covered

Tests only cover the pure functions in `lib/` (shared between main process,
renderer, and tests):

- `lib/validate-todos.js` — todo shape/size limits, stage + priority enums,
  prototype-pollution guard (unexpected-key rejection)
- `lib/parse-json-array.js` — defensive parsing of AI JSON responses

The renderer (`app.js`) and main process (`main.js`) have **no unit tests**
— verify those by driving the real app with the `verify` skill instead.

## Conventions for new tests

- `node:test` + `node:assert` only — no test framework dependencies.
- One file per lib module: `test/<module>.test.js`, picked up automatically
  by the glob.
- `require('../lib/<module>')` — lib files use a UMD-ish wrapper so they
  load both as plain renderer scripts and via `require()`.
- Small factory helpers for fixtures (see `makeTodo()` in
  `test/validate-todos.test.js`); test behavior and limits, not internals.
- Logic that only exists inside `app.js`/`main.js` must first be extracted
  into `lib/` as a pure function before it can be unit-tested.
