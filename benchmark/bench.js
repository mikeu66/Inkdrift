// Benchmark: Ollama (llama3.2:3b) vs Claude Haiku on InkDrift's four AI tasks.
// Runs inside Electron (app name "inkdrift") so safeStorage can decrypt the
// stored Anthropic key in-process. The key is never logged or written out.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const Anthropic = require(path.join(__dirname, '..', 'node_modules', '@anthropic-ai/sdk'));

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.2:3b';
// claude-3-haiku-20240307 (what the app currently uses) returns 404 — retired.
const HAIKU_MODEL = 'claude-haiku-4-5';
const RUNS = 3;
const OUT = process.env.BENCH_OUT || path.join(__dirname, 'results.json');

// ---------- prompts copied verbatim from app.js ----------
const BRAINSTORM_PROMPT = `You're helping someone think through a project. Have a natural conversation - no rigid structure, no checklists.

CRITICAL RULE: Ask exactly ONE question per response. End your message after that single question. Do not ask follow-up questions in the same message.

BAD (never do this): "What's the main goal? And who's the target audience? Have you thought about the tech stack?"
GOOD: "What's the main goal you're trying to achieve with this project?"

Your style:
- Be conversational, not formulaic
- Follow their lead - if they want to talk about tech first, go with it
- Share thoughts and suggestions naturally
- It's fine to explore tangents if they seem useful

Things worth understanding (explore one at a time through conversation):
- What they're building and why
- Who it's for
- Technical approach
- What's MVP vs later
- Potential challenges

Keep responses concise. One question only.`;

const PLAN_PROMPT = `Based on this brainstorming conversation, create a project plan in markdown.

Structure it naturally based on what was discussed - don't force sections that weren't covered. Include:
- A clear summary of what's being built
- Key decisions made
- Next steps or phases if discussed
- Any risks or considerations mentioned

Keep it practical and actionable. This will be used by a developer (possibly with AI assistance) to build the project.`;

const ACTION_ITEMS_PROMPT = `Based on this project plan, generate 5-10 specific action items in chronological order (when they need to be done).

For each action item provide:
1. A clear, actionable task description (what to do)
2. Estimated hours needed (be realistic, use whole numbers)

Return ONLY a valid JSON array with no other text:
[{"text": "Description here", "hoursNeeded": 4}, ...]`;

const GRANULATE_SYSTEM = 'You are a project planning assistant. Break action items into concrete sub-tasks. Return only valid JSON.';

// ---------- fixtures ----------
const CONVERSATION = [
    { role: 'user', content: 'Project: Family Recipe Box\n\nNotes:\nA simple app to save and organize family recipes so my sister and I can both use them.' },
    { role: 'assistant', content: "That sounds like a great project! What's the main way you imagine using it day to day — quickly saving new recipes, or browsing and cooking from ones you've already saved?" },
    { role: 'user', content: "Mostly browsing while cooking. I'd add recipes in batches on weekends. It needs to work well on my phone in the kitchen." },
    { role: 'assistant', content: 'Got it — so the cooking view matters most. When you\'re at the stove, what would make a recipe easiest to follow: big step-by-step text, an ingredient checklist, or something else?' },
    { role: 'user', content: "Big steps with the ingredients pinned at the top. Search by ingredient would be great too. Keep it a simple web app, no accounts — just a shared link my sister can open." }
];

const PLAN_FIXTURE = `# Family Recipe Box — Project Plan

## Summary
A simple mobile-friendly web app for saving and browsing family recipes. Two users (the owner and their sister) share one collection via a shared link — no accounts.

## Key Decisions
- Web app, optimized for phone use in the kitchen
- Cooking view: large step-by-step instructions with ingredients pinned at the top
- Search by ingredient
- Recipes added in batches on weekends; browsing is the primary daily use
- No authentication; a private shared link controls access

## Phases
1. **MVP**: recipe entry form (title, ingredients, steps), recipe list, cooking view
2. **Search**: ingredient-based search and simple filters
3. **Sharing**: shareable read link for the sister
4. **Polish**: photos, print-friendly view

## Risks
- Shared-link privacy is weak; acceptable for family use
- Phone screen space is limited — pinned ingredients must stay compact`;

const GRANULATE_ITEM = { text: 'Build the recipe entry form with fields for title, ingredients, and steps', hoursNeeded: 4 };

// ---------- shared parser (same module the app and tests use) ----------
const { parseJsonArrayResponse } = require(path.join(__dirname, '..', 'lib', 'parse-json-array'));

// ---------- providers (Ollama request shape copied from main.js) ----------
async function callOllamaRaw({ systemPrompt, messages, options = {} }) {
    const body = {
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        options: {
            num_predict: options.max_tokens || 2048,
            temperature: options.temperature !== undefined ? options.temperature : 0.7
        }
    };
    if (options.responseFormat === 'json') {
        body.format = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    hoursNeeded: { type: 'number' }
                },
                required: ['text'],
                additionalProperties: true
            }
        };
    }
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    if (!data.message || !data.message.content) throw new Error('Empty response from Ollama');
    return {
        text: data.message.content,
        tokensOut: data.eval_count || null,
        tokensIn: data.prompt_eval_count || null,
        genSeconds: data.eval_duration ? data.eval_duration / 1e9 : null
    };
}

let anthropicClient = null;
async function callHaiku({ systemPrompt, messages, options = {} }) {
    const response = await anthropicClient.messages.create({
        model: HAIKU_MODEL,
        max_tokens: options.max_tokens || 2048,
        temperature: options.temperature || 1.0,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
    });
    return {
        text: response.content[0].text,
        tokensOut: response.usage ? response.usage.output_tokens : null,
        tokensIn: response.usage ? response.usage.input_tokens : null,
        genSeconds: null
    };
}

// ---------- quality checks ----------
function wordCount(t) { return t.trim().split(/\s+/).length; }

const TASKS = [
    {
        name: 'brainstorm-chat',
        request: {
            systemPrompt: BRAINSTORM_PROMPT,
            messages: CONVERSATION,
            options: { max_tokens: 2048, temperature: 0.5 }
        },
        check(text) {
            const questions = (text.match(/\?/g) || []).length;
            const words = wordCount(text);
            return {
                pass: questions === 1 && words <= 200,
                detail: { questions, words }
            };
        }
    },
    {
        name: 'plan-generation',
        request: {
            systemPrompt: PLAN_PROMPT,
            messages: [{
                role: 'user',
                content: CONVERSATION.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
            }],
            options: { max_tokens: 4096, temperature: 0.7 }
        },
        check(text) {
            const hasStructure = /^#{1,3}\s|\n#{1,3}\s|\n- |\n\* |\*\*/.test(text);
            const keywords = ['recipe', 'ingredient', 'search', 'sister', 'phone', 'link'];
            const hits = keywords.filter(k => text.toLowerCase().includes(k)).length;
            const words = wordCount(text);
            return {
                pass: hasStructure && hits >= 4 && words >= 80,
                detail: { hasStructure, keywordHits: `${hits}/${keywords.length}`, words }
            };
        }
    },
    {
        name: 'action-items',
        request: {
            systemPrompt: ACTION_ITEMS_PROMPT,
            messages: [{ role: 'user', content: PLAN_FIXTURE }],
            options: { max_tokens: 2048, responseFormat: 'json' }
        },
        check(text) {
            let strictJson = true;
            try { JSON.parse(text.trim()); } catch { strictJson = false; }
            let items, parseError = null;
            try { items = parseJsonArrayResponse(text); } catch (e) { parseError = e.message; }
            if (!items) return { pass: false, detail: { parseError, strictJson } };
            const count = items.length;
            const withHours = items.filter(i => typeof i.hoursNeeded === 'number' && i.hoursNeeded >= 1).length;
            return {
                pass: count >= 5 && count <= 10 && withHours === count,
                detail: { count, withHours, strictJson }
            };
        }
    },
    {
        name: 'granulate-subtasks',
        request: {
            systemPrompt: GRANULATE_SYSTEM,
            messages: [{
                role: 'user',
                content: `Break this action item into 3-5 specific, actionable sub-tasks.\n\nAction Item: "${GRANULATE_ITEM.text}"\nEstimated Hours: ${GRANULATE_ITEM.hoursNeeded}\n\nProject Context:\n${PLAN_FIXTURE}\n\nReturn ONLY a valid JSON array with no other text:\n[{"text": "Sub-task description here"}, ...]`
            }],
            options: { max_tokens: 1024, responseFormat: 'json' }
        },
        check(text) {
            let strictJson = true;
            try { JSON.parse(text.trim()); } catch { strictJson = false; }
            let items, parseError = null;
            try { items = parseJsonArrayResponse(text); } catch (e) { parseError = e.message; }
            if (!items) return { pass: false, detail: { parseError, strictJson } };
            return {
                pass: items.length >= 3 && items.length <= 5,
                detail: { count: items.length, strictJson }
            };
        }
    }
];

async function runProvider(providerName, callFn) {
    const results = [];
    for (const task of TASKS) {
        for (let run = 1; run <= RUNS; run++) {
            const started = Date.now();
            let entry = { provider: providerName, task: task.name, run };
            try {
                const r = await callFn(task.request);
                entry.latencyMs = Date.now() - started;
                entry.tokensIn = r.tokensIn;
                entry.tokensOut = r.tokensOut;
                entry.genSeconds = r.genSeconds;
                const c = task.check(r.text);
                entry.pass = c.pass;
                entry.detail = c.detail;
                entry.sample = r.text.slice(0, 400);
            } catch (e) {
                entry.latencyMs = Date.now() - started;
                entry.pass = false;
                entry.error = e.message;
            }
            console.log(`[${providerName}] ${task.name} run ${run}: ${entry.pass ? 'PASS' : 'FAIL'} ${entry.latencyMs}ms ${entry.error ? '(' + entry.error + ')' : JSON.stringify(entry.detail)}`);
            results.push(entry);
        }
    }
    return results;
}

app.whenReady().then(async () => {
    if (app.dock) app.dock.hide();
    try {
        // Decrypt the app's stored key exactly as main.js does. Never logged.
        const keyPath = path.join(app.getPath('userData'), 'secure-key.bin');
        let apiKey = process.env.ANTHROPIC_API_KEY || null;
        if (!apiKey && fs.existsSync(keyPath) && safeStorage.isEncryptionAvailable()) {
            apiKey = safeStorage.decryptString(fs.readFileSync(keyPath));
        }
        if (!apiKey) {
            console.error('NO_API_KEY: could not obtain Anthropic key');
        } else {
            anthropicClient = new Anthropic({ apiKey });
        }

        const all = [];
        if (!process.env.SKIP_OLLAMA) {
            all.push(...await runProvider('ollama/' + OLLAMA_MODEL, callOllamaRaw));
        }
        if (anthropicClient) {
            all.push(...await runProvider('claude/' + HAIKU_MODEL, callHaiku));
        }
        fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
        console.log('DONE, results written to ' + OUT);
    } catch (e) {
        console.error('BENCH_ERROR: ' + (e.stack || e.message));
    } finally {
        app.quit();
    }
});
