<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RAG Application — Agent Guide

This document tells coding agents (and humans) everything needed to understand,
run, and extend this project. Read it fully before making changes.

## 1. Project Overview

- **Name:** `rag`
- **Type:** Next.js web application (App Router) bootstrapped with `create-next-app`.
- **Goal:** A Retrieval-Augmented Generation (RAG) app — a knowledge-grounded
  AI interface built on Next.js + the Vercel AI SDK.
- **Status:** Fresh scaffold (default starter page). RAG features are not yet
  implemented; the installed skills below guide how to build them.

## 2. Tech Stack

| Concern        | Choice                          | Version |
| -------------- | ------------------------------- | ------- |
| Framework      | Next.js (App Router, Turbopack) | 16.2.9  |
| UI library     | React                           | 19.2.4  |
| Language       | TypeScript                      | ^5      |
| Styling        | Tailwind CSS                    | ^4      |
| Linting        | ESLint + eslint-config-next     | ^9      |
| Runtime        | Node.js                         | v26.x   |

## 3. Project Structure

```
rag/
├─ app/                  # App Router routes, layouts, pages
│  ├─ layout.tsx         # Root layout
│  ├─ page.tsx           # Home page (default starter)
│  ├─ globals.css        # Global styles (Tailwind)
│  └─ favicon.ico
├─ public/               # Static assets (svg icons)
├─ .agents/skills/       # Installed agent skills (see §6)
├─ next.config.ts        # Next.js config
├─ tsconfig.json         # TypeScript config
├─ eslint.config.mjs     # ESLint config
├─ postcss.config.mjs    # PostCSS / Tailwind config
├─ package.json
└─ AGENTS.md             # This file
```

When adding RAG functionality, prefer:
- `app/api/**/route.ts` for server route handlers (chat, embeddings, retrieval).
- `lib/` for shared logic (vector store clients, chunking, retrieval helpers).
- Keep secrets/keys in `.env.local` (never commit them).

## 4. Environment Setup (Windows / PowerShell)

Node.js is installed at `C:\Program Files\nodejs` but may not be on a fresh
terminal's PATH until the terminal is restarted.

- **If `node`/`npm`/`npx` are not recognized**, either restart the terminal or
  prepend Node to PATH for the current session:
  ```powershell
  $env:Path = "C:\Program Files\nodejs;" + $env:Path
  ```
- **PowerShell execution policy** blocks the `npm.ps1` / `npx.ps1` wrappers on
  this machine. Two options:
  - Call the `.cmd` wrappers directly (no policy change needed):
    ```powershell
    & "C:\Program Files\nodejs\npm.cmd" <args>
    & "C:\Program Files\nodejs\npx.cmd" <args>
    ```
  - Or fix it permanently in an elevated PowerShell:
    ```powershell
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
    ```

## 5. Commands / How to Run

All scripts come from `package.json`. Run from the project root.

| Task              | Command          | Notes                                        |
| ----------------- | ---------------- | -------------------------------------------- |
| Install deps      | `npm install`    | Run after cloning or changing deps           |
| Dev server        | `npm run dev`    | http://localhost:3000 (hot reload)           |
| Production build  | `npm run build`  | Creates optimized build in `.next/`          |
| Start (prod)      | `npm run start`  | Serves the production build; build first     |
| Lint              | `npm run lint`   | ESLint over the project                      |

If the `.ps1` wrappers are blocked, substitute `& "C:\Program Files\nodejs\npm.cmd"`
for `npm` in any command above, e.g.:
```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

> Note for agents: `dev` and `start` are long-running processes. They will not
> exit on their own — run them in a dedicated terminal, or expect a tool
> timeout (the server still started successfully if you saw `✓ Ready`).

## 6. Installed Agent Skills

Skills live in `.agents/skills/`. Each has a `SKILL.md` describing when and how
to use it. They run with full agent permissions — review before use.

| Skill                 | Source                              | Risk | Purpose |
| --------------------- | ----------------------------------- | ---- | ------- |
| `rag-implementation`  | github.com/wshobson/agents          | Low  | Build RAG systems: vector DBs, semantic search, document Q&A, knowledge-grounded AI. |
| `ai-sdk`              | github.com/vercel/ai                | Med  | Vercel AI SDK: `generateText`, `streamText`, agents, tool calling, embeddings, `useChat`. Checks `node_modules/ai/docs/`. |
| `next-best-practices` | github.com/vercel-labs/next-skills  | Low  | Next.js conventions: RSC boundaries, data patterns, async APIs, route handlers, optimization. |
| `frontend-design`     | github.com/anthropics/skills        | Low  | Distinctive, intentional UI/visual design guidance (palette, typography, layout). |
| `find-skills`         | github.com/vercel-labs/skills       | Med  | Discover and install additional skills from the ecosystem. |

**Add another skill:**
```powershell
& "C:\Program Files\nodejs\npx.cmd" skills add <repo-url> --skill <skill-name>
```

### IMPORTANT: Always use relevant installed skills

Agents **must load and follow the relevant skill** whenever a task matches one
of the skills below. Do not rely on prior/internal knowledge for these areas —
the skills contain version-correct, project-specific guidance that overrides
general assumptions. Load a skill by reading its `.agents/skills/<name>/SKILL.md`
(and any files it references) **before** writing code, and re-check it whenever
the task shifts into another skill's domain. Skills run with full agent
permissions, so review before executing anything they instruct.

**Trigger map — use the skill when the task involves:**

| Use this skill        | When the task involves...                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `rag-implementation`  | Retrieval, vector databases, embeddings storage, chunking, semantic search, document Q&A, knowledge-grounded answers, top-k retrieval, re-ranking. |
| `ai-sdk`              | Any Vercel AI SDK usage: `generateText`, `streamText`, `embed`, agents, tool calling, structured output, or React hooks `useChat` / `useCompletion`. First check `node_modules/ai/docs/`. |
| `next-best-practices` | Any Next.js work: routes, layouts, RSC/client boundaries, route handlers, data fetching, async APIs, metadata, error handling, image/font optimization, bundling. |
| `frontend-design`     | Building or restyling UI: visual direction, palette, typography, layout, component aesthetics. |
| `find-skills`         | The user wants a capability not covered above, or asks "is there a skill for X" / how to extend the agent. |

**Rules of thumb:**
- If a request spans multiple areas, consult **each** relevant skill (e.g., a
  RAG chat feature → `rag-implementation` + `ai-sdk` + `next-best-practices`,
  then `frontend-design` for the UI).
- When unsure whether a skill applies, open its `SKILL.md` and check its
  `description`/"When to Use" section before proceeding.
- Prefer skill guidance over assumptions; if a skill conflicts with this file,
  the skill wins for its domain (except the non-standard Next.js rule at the top,
  which always applies).

## 7. Conventions & Guardrails

- **Next.js version is non-standard.** Before writing Next.js code, consult
  `node_modules/next/dist/docs/` and the `next-best-practices` skill rather than
  relying on prior training knowledge (see the rules block at the top).
- **TypeScript everywhere.** Keep `tsconfig` strictness; type new modules.
- **Server vs. client.** Default to Server Components; add `"use client"` only
  when interactivity/hooks are required.
- **Secrets.** Store API keys (OpenAI, Anthropic, vector DB, etc.) in
  `.env.local`. Never hardcode or commit them.
- **Verify before claiming done.** Run `npm run lint` and `npm run build` after
  meaningful changes.
- **Don't commit/push** unless explicitly asked.

## 8. Typical Tasks (Playbook)

- **Add a chat/RAG endpoint:** create `app/api/chat/route.ts`; use the `ai-sdk`
  skill for `streamText`/tools; install provider package only when needed
  (e.g., `@ai-sdk/openai`).
- **Add retrieval:** follow `rag-implementation` — chunk documents, generate
  embeddings, store in a vector DB, retrieve top-k, inject into the prompt.
- **Build the UI:** use `@ai-sdk/react` `useChat` for the client; apply
  `frontend-design` for the look and feel.
- **Before finishing:** `npm run lint` then `npm run build`; start with
  `npm run dev` to smoke-test at http://localhost:3000.

## 9. Project Log (keep updated — important decisions only)

> Maintain this section as the project progresses. Add only durable, important
> instructions/decisions a future agent must know — not routine activity.

- **Git remote:** `origin` → `https://github.com/majidmtl123/AI_RAG_DATAANALYSIS.git`
  (default branch `master`).
- **Credentials:** `.env` (gitignored) holds `GH_TOKEN`, `GH_USER`,
  `ANTHROPIC_API_KEY`. Read these from `.env` when pushing; never commit them and
  never write the token into git config — use it inline for the push URL only.
- **Skills installed:** `rag-implementation`, `ai-sdk`, `next-best-practices`,
  `frontend-design`, `find-skills` (see §6). Provider: **Anthropic** (key present).
- **Status:** Universal Excel Analysis Tool implemented (v1). Build + lint pass;
  end-to-end smoke test verified (upload → Claude tool call → sandbox compute →
  7-part report).

### Excel Analysis Tool — architecture (v1)

- **One universal tool only** (`lib/tools/analyze-data.ts`). Do NOT add per-domain
  tools (sales/HR/finance). All analysis flows through `analyzeData`.
- **LLM never does math.** Claude writes JS that runs in a sandbox; every number
  comes from computed tool output. The system prompt enforces this.
- **Provider/model:** Anthropic direct via `@ai-sdk/anthropic`, model
  `claude-sonnet-4-6` (`lib/agents/analyst-agent.ts`, `ANALYST_MODEL`). Reads
  `ANTHROPIC_API_KEY` from `.env.local` (copied from `.env`; both gitignored).
- **Sandbox:** `lib/analysis/sandbox.ts` runs model code in a `worker_threads`
  worker + `node:vm` context (no require/fs/net/timers), 5s timeout, 256MB cap,
  output capped to 1000 rows. Chose worker+vm over `isolated-vm` to avoid native
  build friction on Windows/Node 26. `vm` is not a hard security boundary — keep
  the context stripped; revisit `isolated-vm` if untrusted input is ever added.
- **Helpers** exposed to sandbox live in `lib/analysis/helpers.ts` as a SOURCE
  STRING (`HELPERS_SOURCE`) + a prompt doc (`HELPERS_DOC`). Update both together.
- **Dataset state:** parsed workbook kept in an in-memory store
  (`lib/store/datasets.ts`) keyed by `datasetId` (TTL 1h, max 25, survives dev
  hot-reload via globalThis). Lost on restart; single-instance only. Chat sends
  only `datasetId` + history; the tool reads rows via `experimental_context`.
- **Routes:** `app/api/upload/route.ts` (parse + profile + store → `{datasetId,
  dictionary}`), `app/api/chat/route.ts` (builds per-request agent with the data
  dictionary in instructions, streams `toUIMessageStreamResponse()`).
- **AI SDK gotchas (this version):** `convertToModelMessages` is async (await it);
  `experimental_context` is an Agent **setting**, not a `stream()` param; `useChat`
  manages no input state (use `useState` + `sendMessage` + `DefaultChatTransport`).
- **UI:** `app/excel/page.tsx` (client; moved from `app/page.tsx`). "Engineering
  plotter" theme (graph-paper grid, mono data chips) in `app/globals.css`. Answers
  render via a tiny dependency-free Markdown renderer (`lib/markdown.ts`). Output
  uses a fixed 7-part report format.
- **Scope:** v1 = data dictionary, NL querying, aggregation/filter/trend/compare/
  top-N, conversational follow-ups, 7-part output. v2 (later) = forecasting,
  anomaly detection, root-cause, KPI presets, real chart rendering.

### Screenshot Analysis Tool — architecture (v1)

- **Second universal tool.** Converts screenshots → structured data via OCR, then
  reuses the SAME `analyzeData` sandbox tool + dataset store + report patterns.
- **Engine = Tesseract OCR + Claude (NOT vision).** `tesseract.js@7` (WASM, no
  native build) reads text; Claude structures the OCR text into a dataset. Charts
  are read as TEXT only — chart-shape geometry (unlabelled lines/bars) is out of
  scope and the agent flags it. v2 path: add the image as a vision part.
- **Pipeline:** `lib/ocr/preprocess.ts` (sharp: grayscale/upscale/normalize) →
  `lib/ocr/ocr.ts` (cached Tesseract worker) → `lib/ocr/extract.ts` (Claude
  `generateText` + `Output.object`/zod → tables + chart/KPI metadata + limitations)
  → reuse `excel/profile.ts` → store with `source: "screenshot"` + `extraction`.
- **tesseract.js + Next.js gotchas (important):**
  - Add `serverExternalPackages: ["tesseract.js","sharp"]` in `next.config.ts` so
    the bundler doesn't rewrite their internal paths.
  - Pass explicit `workerPath`/`corePath`/`cachePath` to `createWorker`, resolved
    from `process.cwd()/node_modules` (NOT `import.meta.url` — that mis-resolves
    under the bundle and caused a `path must be string, received number` error).
  - Pass a FILE PATH to `worker.recognize()` (write the preprocessed image to a
    temp file), not a Buffer — Buffer input triggered the same path error.
  - First OCR run downloads `eng.traineddata` (cached in `.tesseract-cache/`,
    gitignored). Worker is cached on globalThis across requests/hot-reloads.
- **Routes:** `app/api/screenshot/route.ts` (multi-file OCR→extract→store, max 6
  images/10MB), `app/api/screenshot-chat/route.ts` (screenshot agent). Agent in
  `lib/agents/screenshot-agent.ts`. Output = 6-part format (Direct Answer · Key
  Findings · Supporting Evidence · Insights · Business Impact · Recommended Actions).
- **Navigation:** landing page at `/` (`app/page.tsx`), Excel at `/excel`,
  Screenshot at `/screenshot`. Shared `app/components/MenuBar.tsx` rendered in
  `app/layout.tsx`; layout is `h-dvh` flex column (menu bar + `flex-1 min-h-0`
  page area). Tool pages use `h-full` (not `h-dvh`) so they fit under the menu bar.
