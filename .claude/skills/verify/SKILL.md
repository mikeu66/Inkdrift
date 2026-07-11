---
name: verify
description: Build/launch/drive recipe for verifying changes to the InkDrift Electron app
---

# Verifying InkDrift changes

The app is an Electron GUI (`npm start` = `electron .`). Live source is at the repo **root** (`main.js`, `app.js`, `index.html`, `styles.css`); the `src/` copies are stale — ignore them.

## Drive it with Playwright

No Playwright in the repo. Install `playwright-core` (no browser download needed) in a scratch dir and launch with the project's own Electron:

```js
const { _electron: electron } = require('playwright-core');
const app = await electron.launch({
    executablePath: '<repo>/node_modules/.bin/electron',
    args: ['.'],
    cwd: '<repo>'
});
const win = await app.firstWindow();
```

Run driver scripts with the sandbox disabled (Electron needs to bind its helper processes).

## Gotchas

- **userData is the real one**: `~/Library/Application Support/inkdrift/` (`todos.json`, `settings.json`, `secure-key.bin`). Back up `todos.json`/`settings.json` before driving flows that write, restore after. Never touch `secure-key.bin`.
- Waiting on AI generation: wait for `#actionItemsLoading` to become **hidden** (not for `[class*="action-item"]` counts — those match container/loading elements and fire early).
- Errors surface as `.toast` elements; install a MutationObserver early to capture them.
- Useful ids: `#settingsBtn`, `#providerAnthropic`/`#providerOllama`, `#ollamaUrlInput`, `#ollamaModelSelect`, `#testOllamaBtn`, `#saveOllamaBtn`, `#ollamaMessage`, `#brainstormBtn`, `#bsUserInput`, `#bsSubmitBtn`, `#bsGeneratePlanBtn`, `#bsSaveBtn`, `#generateActionItemsBtn`, `#actionItemsList li.action-item`, `.action-item-granulate-btn`, `.action-item-child`.

## AI backends

- Ollama flows need a local instance: check `curl http://localhost:11434/api/tags`. A ~3B model (`llama3.2:3b`) answers brainstorm turns in a few seconds.
- Anthropic flows use the user's saved key (`secure-key.bin`) and cost money — avoid real Claude calls unless necessary.
