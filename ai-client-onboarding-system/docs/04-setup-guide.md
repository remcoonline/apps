# Setup Guide — zero to live

Do these in order. Each phase is testable on its own before moving to the next.

## Phase 0 — Accounts (one-time, ~20 min)

- [ ] In Zapier, connect **Stripe** (Apps → Connect a new app).
- [ ] In Zapier, connect **DocuSign** (or HelloSign/PandaDoc — swap the app in Zap 1/2, actions are equivalent: send envelope, envelope completed trigger).
- [ ] Confirm **Notion, Google Drive, Google Sheets, Google Calendar, Gmail, Slack** are still connected (they already are as of this build).
- [ ] Get an **Anthropic API key** (console.anthropic.com) for the webhook service.
- [ ] Pick a host for `scripts/` — Vercel, Render, Railway, or any VPS. Free tier is enough at low client volume.

## Phase 1 — Notion portal (build once, duplicate is automatic per-client via shared views)

Follow `notion/portal-schema.md` exactly — create the 6 databases and link them by relation. Takes ~30 min once.

- [ ] `Clients`
- [ ] `Team Roster`
- [ ] `Project Board`
- [ ] `Documents`
- [ ] `Invoices`
- [ ] `AI Briefs`
- [ ] `Onboarding Form Responses`

Build one **Client Portal page template** with linked/filtered views (Documents, Project Board, Invoices filtered to "this client") — Zap 3 duplicates the sharing, not the page itself; one portal page structure works for every client via Notion's linked-database filters.

## Phase 2 — Google Drive template

- [ ] Create a folder `Client Folder Template` with subfolders: `Contracts`, `Brief`, `Deliverables`, `Reports`, `Resource Library` (pre-populate Resource Library with your standard onboarding PDFs/videos — this is what gets shared read-only with every client).
- [ ] Note the folder ID — Zap 3 step 2 copies this folder per client.

## Phase 3 — Deploy the AI service

```bash
cd ai-client-onboarding-system/scripts
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm install
npm start                 # local test on http://localhost:3000
```

Test locally:

```bash
curl -X POST http://localhost:3000/generate-brief \
  -H "Content-Type: application/json" \
  -d @prompts/sample-brief-request.json
```

Then deploy (Vercel: `vercel deploy`; Render/Railway: connect the repo, set `ANTHROPIC_API_KEY` in the dashboard, build command `npm install`, start command `npm start`). Note the deployed base URL — it goes into every Webhooks by Zapier step in Zaps 4 and 6.

## Phase 4 — Templates

- [ ] Turn `templates/contract-template.md` into your actual legal contract (have it reviewed by counsel — this repo ships the merge-field structure, not legal language), then build it as a DocuSign template with matching merge fields.
- [ ] Load `templates/welcome-letter-template.md` and `templates/tool-access-email-template.md` into Gmail as templates (Gmail Settings → Templates) or paste directly into the Zap's Gmail step — either works, the Zap step is the source of truth either way.
- [ ] Build the onboarding form (Google Forms is simplest since Sheets is already connected) using the fields in `templates/onboarding-form-schema.md`.

## Phase 5 — Build the Zaps

Follow `docs/02-zapier-recipes.md` in order: Zap 1 → 2 → 3 → 4 → 6. Turn on Zap fail notifications (Zapier → Zap settings → Notifications) on every one.

## Phase 6 — End-to-end test

- [ ] Run a fake client through the whole pipeline using your own email at every step (fake webhook POST to trigger Zap 1, sign the DocuSign envelope yourself, pay a $1 test Stripe invoice in test mode, submit the onboarding form).
- [ ] Confirm: contract arrives instantly, welcome letter + tool access emails arrive within ~60 seconds of "payment," kickoff call appears on calendar, brief email arrives after form submission, portal is shared and populated.
- [ ] Only then point Zap 1's webhook at your real CRM/lead-source trigger and go live.

## Ongoing

- Monthly report Zap needs nothing after setup — it runs itself on the 1st.
- When you sign a new client, everything after Zap 1 fires automatically. The only manual step left, ever, is deciding a lead is a "Yes" — which is the one decision that should stay human.
