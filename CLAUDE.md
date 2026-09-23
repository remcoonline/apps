# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

This repository (`remcoonline/apps`) is a landing spot for apps uploaded from Google AI Studio, not a checked-out application source tree. At the root there is currently only:

- `README.md` — one-line description of the repo's purpose (apps for remcoonline, uploaded from a local machine).
- `LICENSE`
- `copy-of-ai-credit-card-tracker (1).zip` — a zipped Google AI Studio export containing the actual application source. **This is the real codebase**; nothing is checked out at the root.

Before doing any work on the app, extract the archive:

```bash
unzip "copy-of-ai-credit-card-tracker (1).zip" -d ai-credit-card-tracker
```

In Claude Code on the web sessions, the SessionStart hook (`.claude/hooks/session-start.sh`) does this extraction and runs `npm install` automatically; it skips extraction if `ai-credit-card-tracker/package.json` already exists, so local edits are never overwritten.

Do not extract it in place at the repo root — the zip's own `README.md` and `.gitignore` would collide with the repo's top-level files. If more app archives are added to this repo later, follow the same pattern: extract each into its own sibling directory rather than merging them at the root.

## The app: AI Credit Card Tracker

A single-page React app (originally generated/exported from Google AI Studio) for tracking credit card balances, minimum payments, and due dates, with a Gemini-powered chat assistant for financial Q&A. All data is client-side only — there is no backend.

### Development workflow (run inside the extracted app directory)

```bash
npm install
npm run dev       # Vite dev server on http://localhost:3000 (host 0.0.0.0)
npm run build      # production build via Vite
npm run preview    # preview the production build
```

There is no lint or test tooling configured (no ESLint/Prettier config, no test runner, no `test`/`lint` npm scripts) — do not assume any exist.

Set `GEMINI_API_KEY` in `.env.local` (currently checked in with a placeholder value) to enable the AI Assistant panel; without it, `geminiService.ts` returns an explanatory error message instead of calling the API.

### Architecture

- **State and persistence**: `App.tsx` is the single source of truth. All credit cards live in one `CreditCard[]` array held by the `useLocalStorage` hook (`hooks/useLocalStorage.ts`), which mirrors state to/from `window.localStorage` under the key `creditCards`. There is no other persistence layer — no database, no server API.
- **Data flow**: `App.tsx` owns all mutation handlers (add/edit/delete/import) and passes callbacks down as props; components are presentational and do not touch `localStorage` directly.
- **Due-date logic**: centralized in `services/dateService.ts` (`calculateDateInfo`), which derives the next due date, days-until-due, and overdue status from a card's `dueDay` (1–31). This is the only place that logic should live — components (e.g. `CardRow.tsx`) call it rather than reimplementing date math.
- **AI integration**: `services/geminiService.ts` wraps `@google/genai`, building a prompt from the user's card data plus their free-text question and calling `gemini-2.5-flash`. It is the only file that talks to the Gemini API; `AiAssistant.tsx` is purely a chat UI over it.
- **CSV import**: `ImportModal.tsx` parses CSV client-side (naive `split(',')`, no library) and only *updates* cards whose `name` matches an existing card (case-insensitive) — it never creates new cards from CSV import. Expected columns: `Card Name,Current Balance,Minimum Payment`.
- **Types**: `types.ts` defines the two core shapes (`CreditCard`, `DateInfo`) used across the app.
- **Styling**: Tailwind CSS loaded via CDN `<script>` in `index.html` (no Tailwind build step/config) plus a plain `index.css`. Components use Tailwind utility classes inline; there is no CSS-in-JS or component styling library.
- **Module loading**: `index.html` uses an import map pointing `react`, `react-dom`, and `@google/genai` at `aistudiocdn.com`, alongside the normal npm-installed copies used by Vite's dev/build pipeline — an artifact of the AI Studio export. Keep both in sync if upgrading these dependencies.
- **Path alias**: `@/*` maps to the app root (see `tsconfig.json` / `vite.config.ts`), though existing code consistently uses relative imports instead.
