# Site Audit AI

Mobile app (Expo / React Native) that audits any website and produces a 5-section growth report:

1. **Executive Summary & Health Score** (A+–F, 0–100)
2. **Pros & Cons**
3. **60-day roadmap**: technical quick wins → content authority → backlinks
4. **AI & Automation Growth Stack**: SEO automation, content, GEO/AI-search monitoring, CRM and lead capture
5. **5-step action checklist for this week**

## How it works

| Step | What happens | Where |
|---|---|---|
| 1. Crawl | Fetches the homepage, `robots.txt`, sitemap and `llms.txt` directly from your phone | `src/lib/crawl.ts` |
| 2. Score | 23 measured checks (HTTPS, speed, indexability, title/meta/H1, word count, schema, AI-bot blocking, llms.txt, lead capture, tracking) → reproducible technical score | `src/lib/score.ts` |
| 3. Research & write | Claude gets the measured data, uses web search and web fetch to research rankings, competitors and AI-answer-engine footprint, then writes the report | `src/lib/audit.ts` |
| 4. Save & share | Reports are saved on the device; the **Share** button sends the full report to email, Slack, Drive or text | `src/lib/storage.ts` |

The app shows two scores. **Overall health** is Claude's judgment. **Technical score** is measured and deterministic, so you can re-run it after fixes to prove progress.

## Run it

```bash
cd seo-audit-app
npm install
npx expo start
```

Scan the QR code with **Expo Go**, open **Settings**, paste your Anthropic API key (from https://platform.claude.com/settings/keys) and run an audit.

- Use your **phone**, not the web preview (`w`). Browsers block cross-site requests, so the on-device crawl fails on web. Claude still fetches the site itself, but the measured checks tab will be empty.
- Model: **Claude Opus 5** by default (deepest analysis). Switch to **Sonnet 5** in Settings for faster, cheaper runs.
- Cost: roughly $0.30–$1.00 per audit on Opus 5, depending on how much web research runs.
- The API key is stored in the device keychain (`expo-secure-store`). There is no backend. Don't ship this build to customers without moving the Claude call behind a server.

## Project layout

```
src/app/_layout.tsx        Stack navigator
src/app/index.tsx          URL input, progress, audit history
src/app/report/[id].tsx    Report and measured-checks tabs, Share
src/app/settings.tsx       API key and model
src/components/markdown.tsx  Dependency-free Markdown renderer
src/lib/…                  crawl, score, audit (Claude), storage, theme
```

Checks: `npx tsc --noEmit`, `npx expo export --platform android`.
