# Data Analyst — AI Data Analysis Tools

Two universal AI-powered tools that turn raw data into real answers. Built with
Next.js (App Router), the Vercel AI SDK, and Anthropic Claude. Every number is
**computed in a sandbox, never guessed by the model**.

1. **Excel Analysis** (`/excel`) — upload an `.xlsx`/`.csv` workbook and ask
   questions in plain English. One universal tool reads every sheet, builds a
   data dictionary, and answers with sandbox-computed figures.
2. **Screenshot Analysis** (`/screenshot`) — upload screenshots of dashboards,
   reports, tables, or charts. OCR (Tesseract) extracts the text, Claude
   structures it into a queryable dataset, and you ask questions the same way.

A landing page at `/` links both tools, and a shared menu bar provides navigation.

## How it works

```
Upload ──► Parse / OCR ──► Build data dictionary ──► In-memory dataset store
                                                              │
Question ──► Claude agent (1 universal tool) ──► writes JS ──►│
                                                              ▼
                                          Sandboxed compute (worker + vm)
                                                              │
                                                              ▼
                                      Structured report (Markdown, streamed)
```

- **One universal tool per app.** No per-domain tools (sales/HR/finance). All
  analysis flows through a single `analyzeData` tool.
- **The LLM never does math.** Claude writes JavaScript that runs in an isolated
  worker (`node:vm`, no `require`/fs/network, 5s timeout); all figures come from
  the computed tool output.
- **Conversational.** Follow-ups ("break it down by region", "top 10", "why")
  keep context within the session.

## Tech stack

| Concern    | Choice                                  |
| ---------- | --------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)      |
| UI         | React 19 + Tailwind CSS 4               |
| Language   | TypeScript                              |
| AI         | Vercel AI SDK (`ai`) + `@ai-sdk/anthropic` (Claude `claude-sonnet-4-6`) |
| OCR        | `tesseract.js` (WASM) + `sharp` (preprocess) |
| Excel      | `xlsx` (SheetJS)                        |

## Getting started

### 1. Prerequisites

- Node.js (v20+; developed on v26).
- An Anthropic API key.

> **Windows note:** if `npm`/`npx` aren't recognized, restart your terminal or
> prepend Node to PATH: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`. If
> the PowerShell execution policy blocks the `.ps1` wrappers, call the `.cmd`
> versions directly: `& "C:\Program Files\nodejs\npm.cmd" run dev`.

### 2. Install

```bash
npm install
```

### 3. Configure environment

Create `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=your_key_here

# Access control: the app is locked behind a single shared password.
APP_PASSWORD=your_app_password
AUTH_SECRET=a_long_random_string   # used to sign the session cookie
```

Optional: set log verbosity for the server console.

```env
LOG_LEVEL=debug   # debug | info | warn | error | silent (default: info)
```

> The whole app is password-protected. Visitors are redirected to `/login`;
> entering `APP_PASSWORD` sets a signed, HTTP-only session cookie valid for
> 24 hours. Use "Log out" in the menu bar to clear it.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The **first** screenshot OCR run downloads the Tesseract English language data
> (~10–15 MB) into `.tesseract-cache/` (gitignored). It's cached afterward.

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server (hot reload)    |
| `npm run build` | Production build (`.next/`)          |
| `npm run start` | Serve the production build           |
| `npm run lint`  | Run ESLint                           |

## Routes

| Path                     | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `/`                      | Landing page linking both tools                    |
| `/login`                 | Password login (public)                            |
| `/excel`                 | Excel analysis UI                                  |
| `/screenshot`            | Screenshot analysis UI                             |
| `/api/auth/login`        | Set session cookie on correct password             |
| `/api/auth/logout`       | Clear the session cookie                           |
| `/api/upload`            | Parse + profile an Excel workbook, store dataset   |
| `/api/chat`              | Excel analyst agent (streaming)                    |
| `/api/screenshot`        | OCR → structure → profile → store screenshots      |
| `/api/screenshot-chat`   | Screenshot analyst agent (streaming)               |

All routes except `/login` and `/api/auth/*` require a valid session (enforced
by `proxy.ts`).

## Project structure

```
proxy.ts                   # auth guard (Next 16 "Proxy", formerly Middleware)
app/
  page.tsx                 # landing page
  login/page.tsx           # password login
  excel/page.tsx           # Excel analysis UI
  screenshot/page.tsx      # Screenshot analysis UI
  components/MenuBar.tsx    # shared top navigation + log out
  api/
    auth/login/route.ts     auth/logout/route.ts
    upload/route.ts         chat/route.ts
    screenshot/route.ts     screenshot-chat/route.ts
lib/
  auth.ts                  # signed (HMAC) session cookie via Web Crypto
  agents/                  # analyst-agent.ts, screenshot-agent.ts (1 tool each)
  tools/analyze-data.ts    # the single universal analysis tool
  analysis/                # sandbox.ts (worker+vm) + helpers
  excel/                   # parse.ts, profile.ts (data dictionary)
  ocr/                     # preprocess.ts, ocr.ts, extract.ts
  store/datasets.ts        # in-memory dataset store (TTL 1h)
  markdown.ts  logger.ts  types.ts
```

## Deployment (Vercel)

Set these environment variables in **Project → Settings → Environment
Variables** (for Production, Preview, and Development) — they are read from
`.env.local` locally and are **not** committed, so the hosted app needs them
explicitly:

| Variable            | Notes                                            |
| ------------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Your Anthropic key                               |
| `APP_PASSWORD`      | The shared access password                       |
| `AUTH_SECRET`       | Long random string used to sign the session cookie |

After adding or changing variables you must **redeploy** — env changes do not
apply to existing deployments. (A missing `APP_PASSWORD`/`AUTH_SECRET` is what
produces the "Auth is not configured on the server" message.)

> **Serverless note:** on Vercel the in-memory dataset store is not shared
> between function instances, so upload and chat can land on different instances.
> To handle this, the client round-trips the parsed dataset with each chat
> request and the server rehydrates it (`putDataset`) when the store misses — so
> the Excel tool and auth work on serverless without extra infra. The
> **screenshot OCR tool** (`tesseract.js` + `sharp`) still downloads data and
> writes temp files at runtime, which may fail or time out on serverless; for
> reliable production OCR run on a long-lived server/container.

## Notes & limitations

- **State is in-memory.** Datasets live in the Node process (TTL 1h, single
  instance) and are lost on restart — fine for local/dev use.
- **Screenshot charts are read as text only.** OCR captures titles, axes,
  legends, and printed data labels, but not chart geometry (unlabelled line
  slopes / bar heights); the agent flags this when relevant.
- **OCR accuracy** depends on screenshot quality; per-image confidence and any
  caveats are surfaced in the UI.

See `AGENTS.md` for detailed architecture and contributor guidance.
