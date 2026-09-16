# Architecture

## Design principle

**Zapier is the nervous system. Notion is the single source of truth. Claude is the writer. Nobody touches any of it by hand.**

Every step writes back to one place (the `Clients` database in Notion) so the client portal is never "out of date" — it's just a live view of the same records the automations use.

## System diagram (text)

```
"Yes" (form / email / CRM stage change)
        │
        ▼
 ZAP 1 — Contract Out ──────► DocuSign (send envelope)          ──► client inbox
        │
        └────────────────────► Notion: Clients row created (Status: Contract Sent)
                                Slack: #new-clients notified

DocuSign: envelope completed
        │
        ▼
 ZAP 2 — Signed ────────────► Notion: Status → Signed
        │
        └────────────────────► Stripe: send invoice (if not already sent with contract)

Stripe: invoice.payment_succeeded
        │
        ▼
 ZAP 3 — Paid (the "wow" moment, fires in parallel, ~60 sec total)
        ├──► Google Drive: copy client folder template, share with client
        ├──► Slack: create/invite client to shared channel
        ├──► Notion: share portal page with client email
        ├──► Google Calendar: find mutual availability, book kickoff call (both calendars)
        ├──► Gmail: send Welcome Letter (WHAT/WHO/WHEN table, merged — no AI, deterministic)
        ├──► Gmail: send Tool Access email (Drive, Slack, Project Board, Resource Library links)
        └──► Notion: Status → Paid → Onboarding

Client submits onboarding form (Google Form → Sheet, or Notion form)
        │
        ▼
 ZAP 4 — AI Brief ──────────► Webhook → scripts/server.js (Claude) → 1-page brief
        │
        ├──► Notion: brief saved to AI Briefs DB, linked to client
        ├──► Google Drive: brief saved as Doc in client folder
        └──► Gmail/Slack: brief delivered to every assigned team member (loop over Team Roster)

Team works the account
        │
        ▼
 Notion: Project Board / Documents / Invoices updated as work happens
        │
        └──► Client Portal (Notion) reflects it live — zero extra automation needed

Schedule by Zapier — 1st of every month
        │
        ▼
 ZAP 6 — Monthly Report ────► Notion: pull this month's Done + next 30 days' Upcoming
        │
        ▼
        Webhook → scripts/server.js (Claude) → report copy
        │
        ├──► Google Drive/Docs: report saved to client folder
        ├──► Notion: report logged, portal updated
        └──► Gmail: report emailed to client
```

## Data model (Notion — see `notion/portal-schema.md` for full field lists)

- **Clients** — one row per client. The spine everything else relates to. `Status` drives every filter (`Contract Sent → Signed → Paid → Onboarding → Active → Completed`).
- **Team Roster** — who's on each account (Account Manager, Strategist, Fulfillment Lead) and their contact info, so Zaps can loop over "everyone assigned to this client" without hardcoding names.
- **Project Board** — deliverables/tasks, relation to Clients, `Status` (Not started / In progress / Done), `Due Date`, `Completed Date`. This is what the monthly report reads from.
- **Documents** — relation to Clients, file/link, `Type` (Contract / Brief / Report / Deliverable).
- **Invoices** — relation to Clients, amount, status, Stripe link.
- **AI Briefs** — one per client, generated content + checklist of "success looks like" items.
- **Onboarding Form Responses** — raw form answers, relation to Clients.

The **client portal is not a separate build** — it's a Notion page per client with linked/filtered views into Project Board, Documents, and Invoices, shared as a guest. See `notion/portal-schema.md`.

## Why a webhook service for AI generation (not "Code by Zapier" alone)

Zapier's native Anthropic/OpenAI integrations work for simple one-shot prompts, but the Brief and Report both need:
- A fixed system prompt (versioned in this repo, not buried in a Zap step).
- Deterministic output structure (markdown headers Notion/Drive can render consistently).
- A place to unit-test prompt changes before they touch a live client.

`scripts/server.js` is a thin Node/Express service with two routes (`/generate-brief`, `/generate-report`). Zapier does all the data-fetching (Notion "Find Records" steps) and passes a clean JSON payload; the service's only job is calling Claude with the right system prompt and returning structured text. Deploy it anywhere (Vercel, Render, Railway, a $5 VPS) — it's stateless.

## What still needs connecting

Per the current Zapier account, these are **not yet connected** and need OAuth (one-time, by Miguel, in the Zapier UI — this can't be done headlessly):
- **Stripe** (payment trigger + invoice creation)
- **DocuSign** (contract send + signed trigger) — HelloSign/PandaDoc are drop-in equivalents if preferred
- **Calendly** — optional; Google Calendar's native "Find availability" + "Create event" actions cover Step 4 without it, since Google Calendar is already connected.

Already connected and used throughout: **Notion, Google Drive, Google Sheets, Google Calendar, Gmail, Slack, Webhooks by Zapier.**
