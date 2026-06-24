# Session Log

A record of the work done in this session: building two AI data-analysis tools
on Next.js, deploying to Vercel, and hardening it. Newest topics last.

## Summary

Bootstrapped a Next.js app and built **two universal AI tools** (Excel analysis
and Screenshot/OCR analysis) powered by Anthropic Claude via the Vercel AI SDK,
added single-password auth, fixed a serverless 404, and enabled Anthropic prompt
caching. All work is on the `master` branch and pushed to
`https://github.com/majidmtl123/AI_RAG_DATAANALYSIS.git`.

## Environment notes (Windows / PowerShell)

- Node.js installed at `C:\Program Files\nodejs` but not always on PATH. Prepend:
  `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- PowerShell execution policy blocks `npm.ps1`/`npx.ps1`. Use the `.cmd`
  wrappers: `& "C:\Program Files\nodejs\npm.cmd" ...`.
- Long-running dev/start servers time out in the tool; they still start.

## Timeline of work

1. **Project init** — `npx create-next-app` (Next.js 16.2.9, App Router,
   TypeScript, Tailwind 4). Verified dev/build/start.
2. **Installed agent skills** into `.agents/skills/`: `frontend-design`,
   `find-skills`, `next-best-practices`, `ai-sdk`, `rag-implementation`.
3. **Authored `AGENTS.md`** — project guide + instruction to always use relevant
   installed skills; maintained a §9 "Project Log" of durable decisions.
4. **GitHub** — pushed to `majidmtl123/AI_RAG_DATAANALYSIS`. Credentials read
   from gitignored `.env` (`GH_TOKEN`, `GH_USER`), used inline in the push URL
   and masked in output — never committed or written to git config.
5. **Excel Analysis Tool** — single universal `analyzeData` tool; Claude writes
   JS that runs in a sandbox; data dictionary; 7-part report; in-memory dataset
   store; `/excel` UI ("engineering plotter" theme).
6. **Logging** — `lib/logger.ts` (`LOG_LEVEL` env) wired across upload, chat,
   agent steps, tool, and sandbox.
7. **Bug fix** — chat sent `datasetId: null` (stale transport closure); switched
   to per-call `sendMessage(.., { body: { datasetId } })`.
8. **UI fix** — chat box scrolling (`h-dvh` + `min-h-0` on the messages flex
   child).
9. **Screenshot Analysis Tool** — Tesseract OCR + Claude extraction reusing the
   same sandbox tool; 6-part report; `/screenshot` UI.
10. **Menu bar + navigation** — landing page at `/`, Excel moved to `/excel`,
    Screenshot at `/screenshot`; shared `MenuBar`.
11. **Authentication** — single shared password, signed session cookie (24h),
    `proxy.ts` guard, login/logout, "Log out" in menu bar.
12. **Vercel deploy** — env vars must be set in the dashboard + redeploy
    (explains "Auth is not configured"); documented serverless caveats.
13. **Serverless 404 fix** — in-memory store isn't shared across instances, so
    chat got 404. Client now round-trips the dataset; routes rehydrate via
    `putDataset()` on store miss. Verified locally (without payload → 404, with
    payload → 200).
14. **Anthropic prompt caching** — both agents wrap the system prompt with
    `cachedSystem()` (ephemeral, 1h TTL). Verified: turn 1 writes cache
    (`cacheWriteTokens`), turn 2 reads it (`cacheReadTokens`).

## Architecture (current)

```
proxy.ts                     # auth guard (Next 16 "Proxy" = old Middleware)
app/
  page.tsx                   # landing page
  login/page.tsx             # password login
  excel/page.tsx             # Excel analysis UI
  screenshot/page.tsx        # Screenshot analysis UI
  components/MenuBar.tsx      # shared nav + log out
  api/
    auth/login | auth/logout
    upload | chat             # Excel
    screenshot | screenshot-chat
lib/
  auth.ts                    # HMAC session cookie via Web Crypto (Edge + Node)
  agents/                    # analyst-agent.ts, screenshot-agent.ts, cache.ts
  tools/analyze-data.ts      # the single universal analysis tool
  analysis/                  # sandbox.ts (worker_threads + node:vm) + helpers
  excel/                     # parse.ts, profile.ts (data dictionary)
  ocr/                       # preprocess.ts (sharp), ocr.ts (tesseract), extract.ts
  store/datasets.ts          # in-memory store + putDataset (rehydrate)
  markdown.ts  logger.ts  types.ts
```

## Key technical decisions & gotchas

- **One universal tool per app.** No per-domain tools. The LLM never does math —
  Claude writes JS, the sandbox computes every number.
- **Sandbox.** `worker_threads` + `node:vm` (no require/fs/net), 5s timeout,
  256MB cap, output ≤1000 rows. Chose this over `isolated-vm` to avoid native
  build friction. `vm` is not a hard security boundary; keep the context stripped.
- **AI SDK (this version):** `convertToModelMessages` is async; `useChat` manages
  no input state (use `useState` + `DefaultChatTransport` + `sendMessage`);
  `experimental_context` is an Agent setting, not a `stream()` param;
  `onFinish`/`onStepFinish` live on the agent constructor.
- **Prompt caching:** `instructions` as a `SystemModelMessage` with
  `providerOptions.anthropic.cacheControl = { type: 'ephemeral', ttl: '1h' }`.
- **Auth:** Web Crypto HMAC so it runs in both the Edge `proxy.ts` and Node
  routes. Cookie `app_session`, httpOnly, sameSite=lax, secure in prod.
- **tesseract.js + Next.js:** `serverExternalPackages: ["tesseract.js","sharp"]`;
  resolve `workerPath`/`corePath`/`cachePath` from `process.cwd()/node_modules`
  (NOT `import.meta.url`); pass a FILE PATH (not Buffer) to `recognize()`.
- **Serverless statelessness:** in-memory store isn't shared across Vercel
  instances → client round-trips the dataset; routes rehydrate via `putDataset`.

## Env vars

In `.env.local` (gitignored): `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `AUTH_SECRET`.
Optional `LOG_LEVEL` (debug|info|warn|error|silent). On Vercel these must be set
in Project → Settings → Environment Variables, then **redeploy**.

## Stack

Next.js 16.2.9 · React 19 · TypeScript · Tailwind 4 · `ai` + `@ai-sdk/anthropic`
(`claude-sonnet-4-6`) · `tesseract.js` + `sharp` · `xlsx`.

## Commits this session

- `f81cf7d` Add agent skills and project guide
- `13a181f` Add universal Excel and Screenshot AI analysis tools
- `8e8d238` Add single-password authentication
- `7422e34` docs: add Vercel deployment env vars and serverless caveats
- `d0b8546` Fix 404 on /api/chat in serverless (Vercel)
- (uncommitted) Anthropic prompt caching: `lib/agents/cache.ts` + both agents

## Known limitations / follow-ups

- **In-memory store** is per-instance (rehydrated from client payload on
  serverless). For large datasets / durability, back it with KV/Redis/DB.
- **Screenshot OCR on serverless** (`tesseract.js` + `sharp`) downloads data and
  writes temp files at runtime — may fail/time out on Vercel; use a long-lived
  server/container for reliable production OCR.
- **Single shared password** only (no per-user accounts). Change the default
  `APP_PASSWORD` for real use; rotate `ANTHROPIC_API_KEY` if the chat history was
  shared.

## Verification

`npm run lint` and `npm run build` pass. Live smoke tests confirmed: Excel
upload→chat→7-part report, Screenshot OCR→extract→6-part report, auth flow
(redirect/401/login/logout), serverless rehydration, and prompt-cache read/write.
