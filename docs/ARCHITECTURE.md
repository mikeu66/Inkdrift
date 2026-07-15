# Architecture

How InkDrift is put together. For features and setup, see the [README](../README.md).

## Process model

Standard Electron three-layer split, with the renderer fully locked down
(`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`):

```
┌─────────────────────────────┐
│ main.js (main process)      │  storage, settings, API keys,
│                             │  AI provider calls (Claude / Ollama)
└──────────────┬──────────────┘
               │ ipcMain.handle / ipcRenderer.invoke
┌──────────────┴──────────────┐
│ preload.js                  │  contextBridge: exposes a minimal,
│                             │  per-channel electronAPI with input
│                             │  validation on every method
└──────────────┬──────────────┘
┌──────────────┴──────────────┐
│ app.js + index.html (renderer)│ views, state, rendering
└─────────────────────────────┘
```

The renderer never touches the filesystem or network directly — everything
goes through the `electronAPI` bridge.

## Storage

All data lives in Electron's `userData` directory:

| File | Contents |
|---|---|
| `todos.json` | Task list (plain JSON array) |
| `settings.json` | AI provider choice, Ollama URL/model |
| `secure-key.bin` | Anthropic API key, encrypted with `safeStorage` (macOS Keychain) |

Writes go through the main process, which validates the payload with
`lib/validate-todos.js` before persisting: size caps (10,000 todos; 10k-char
task text; 50k-char notes; 100k-char plans), an allowed-key whitelist per
todo (prototype-pollution guard), and stage/priority enum checks.

`localStorage` is used only for the UI theme preference.

## Task model

Each todo moves through a stage pipeline (single source of truth in
`lib/stages.js`):

```
brainstorm → planning → development → refinement → testing → done
```

A todo carries `text`, `notes`, `priority` (high/medium/low), `inProgress`,
optional `subtasks`, and — once AI planning has run — a markdown
`brainstormResult` plus generated `actionItems` (with optional children and
per-item completion, which can auto-complete the parent task).

## Renderer

`app.js` is a single-file renderer with view functions per screen: list,
task detail (planning page), completed, trash, brainstorm chat, and
settings. State lives in module-level variables; every mutation calls
`saveTodos()` (IPC) and re-renders.

Markdown from the AI is rendered with `marked`, sanitized with `DOMPurify`
before insertion, and falls back to escaped plain text if either library is
unavailable. User-entered text is always rendered via `textContent`.

## AI integration

Two interchangeable backends, selected in Settings and dispatched in the
main process:

- **Anthropic Claude** (`claude-haiku-4-5`) via the official SDK; key stored
  encrypted, never exposed to the renderer.
- **Ollama** (local) via its HTTP API; the base URL is validated
  (localhost-style URLs only) before any request.

Both power the same features: brainstorming chat, structured plan
generation, and action-item extraction. Model responses that should be JSON
are parsed defensively by `lib/parse-json-array.js` (shared with the
renderer and unit tests). `benchmark/` contains a comparison of the two
backends on the app's real prompts.

## Security posture

- Strict CSP (`script-src 'self'`, no inline scripts); local file loading only
- Sandboxed, context-isolated renderer; minimal validated IPC surface
- API keys encrypted at rest via OS keychain (`safeStorage`)
- All persisted data validated in the main process before write
- AI markdown sanitized with DOMPurify before rendering

## Tests

`npm test` runs `node:test` suites over the pure functions in `lib/`
(validation limits, prototype-pollution rejection, AI response parsing).
CI runs them on every push via GitHub Actions.
