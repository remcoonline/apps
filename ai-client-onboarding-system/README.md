# AI Client Onboarding System

A zero-manual-intervention onboarding pipeline: the moment a prospect says **"Yes"**, this system carries them through contract → payment → tool access → kickoff → AI-generated brief → live portal → recurring monthly reporting, with no human sending an email, granting access, booking a call, or writing a report by hand.

**Goal:** the client is certain they picked the right team from message #1, never wonders "what happens next," and never has to ask for a status update — so retention goes up and churn goes down.

Built for deployment via **Zapier** (orchestration), **Notion** (client portal + system of record), **Google Workspace** (Drive/Calendar/Gmail), **Slack** (team + client comms), **Stripe** (payment), **DocuSign** (e-signature), and **Claude** (AI brief + report generation). Swap any tool for an equivalent — the recipes note exactly what each step needs, not just the brand name.

## What's in this folder

| Path | What it is |
|---|---|
| `docs/01-architecture.md` | Full system diagram, data model, and how the pieces talk to each other |
| `docs/02-zapier-recipes.md` | The exact Zaps to build — trigger, filter, steps, field mappings, in build order |
| `docs/03-ai-prompts.md` | Production system prompts for the AI Brief and the Monthly Report |
| `docs/04-setup-guide.md` | Step-by-step deployment checklist, start to finish |
| `templates/` | Contract merge-field skeleton, welcome letter, tool-access email, monthly report, onboarding form schema |
| `notion/portal-schema.md` | The Notion databases that make up the client portal |
| `scripts/` | Deployable webhook service (Node/Express) that Zapier calls for AI generation |

## The flow this implements

1. **Contract** — sent for e-signature the instant "Yes" is logged. No delay.
2. **Welcome Letter** — sent ~1 minute after signed + paid, with a WHAT / WHO / WHEN table so the client never wonders what happens next.
3. **Tool Access** — shared drive, team chat, project board, resource library invites land in their inbox the second payment clears.
4. **Kickoff Call** — auto-booked on both calendars based on real availability.
5. **AI Brief** — before the call, Claude reads the onboarding form and writes a 1-page brief ("Success looks like…") for every team member on the account.
6. **Client Portal** — one Notion hub with every document, live work status, and every invoice. No status-update emails, ever.
7. **Monthly Report** — Claude drafts "what got done" / "what's next" from live project data and it's emailed automatically, every month, with zero manual data pulling.

## Fastest path to live

1. Read `docs/04-setup-guide.md` and connect the apps (Stripe and DocuSign aren't connected in Zapier yet — see setup guide).
2. Duplicate the Notion databases in `notion/portal-schema.md`.
3. Deploy `scripts/` (one `npm install && npm start`, or push to Vercel/Render) and set `ANTHROPIC_API_KEY`.
4. Build the 6 Zaps in `docs/02-zapier-recipes.md`, in order.
5. Run one test client end-to-end before going live.
