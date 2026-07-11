# Benchmark: Ollama (llama3.2:3b) vs Claude Haiku — 2026-07-11

Both providers were run against InkDrift's four AI tasks with identical prompts,
parameters, and fixtures (a "Family Recipe Box" project), 3 runs per task.
Pass/fail uses the app's own `parseJsonArrayResponse` plus per-task checks
(one question per brainstorm reply, 5–10 action items with hours, 3–5 subtasks,
plan structure/keywords). Run with:

```
./node_modules/.bin/electron benchmark            # both providers
SKIP_OLLAMA=1 BENCH_OUT=... electron benchmark    # Claude only
```

## Headline

Both models passed **12/12** quality checks. Haiku is ~2x faster; the local
model is free and produced strictly valid JSON (thanks to the Ollama
JSON-schema `format` constraint), while Haiku wraps JSON in markdown fences
(handled by the app's parser).

**Important:** the model the app actually calls, `claude-3-haiku-20240307`,
now returns **404 — it is retired for this API key** (deprecated API-wide,
retires 2026-04-19). The Claude side of this benchmark ran on its replacement,
`claude-haiku-4-5`. The app's Anthropic provider path is broken until the
model ID is updated in `app.js` (4 call sites) and `main.js` (default).

## Latency (median of 3, wall clock)

| Task | llama3.2:3b (local) | claude-haiku-4-5 |
|---|---|---|
| Brainstorm chat reply | 2.2 s | 1.2 s |
| Plan generation (markdown) | 16.0 s | 7.3 s |
| Action items (JSON) | 8.8 s | 3.7 s |
| Sub-task granulation (JSON) | 2.9 s | 2.5 s |

Local generation speed was a steady ~25 tok/s.

## Quality notes

| | llama3.2:3b | claude-haiku-4-5 |
|---|---|---|
| Brainstorm one-question rule | 3/3, concise (25–36 words) | 3/3, concise (35–38 words) |
| Plan structure & fidelity | Good; 4–5/6 fixture keywords, 244–307 words | Slightly richer; 4–5/6 keywords, 357–385 words |
| Action items | 7–10 items, all with hours, strict JSON | Always 10 items with hours, JSON in ```fences |
| Sub-tasks | Always the minimum 3, terser | Always 5, more detailed/actionable |

Qualitatively, Haiku's items are more specific (e.g. mobile responsiveness,
tech-stack setup as an explicit first step) and it fills the allowed range
(5 subtasks vs llama's 3). Llama's outputs are correct but leaner.

## Cost

- All 12 Haiku 4.5 calls: ~7.7K tokens total ≈ **$0.022** (about $0.002 per
  feature use at $1/$5 per MTok).
- Ollama: $0, but occupies ~2 GB RAM while loaded and is 2x slower.

## Verdict

For this app's tasks, llama3.2:3b is a genuinely viable free/offline
default — every output parsed and passed. Haiku 4.5 is noticeably faster and
somewhat richer in output, at negligible cost. The one action item that isn't
optional: bump `claude-3-haiku-20240307` → `claude-haiku-4-5`, or the
Anthropic provider fails outright.
