# Zapier Recipes — build in this order

Each recipe lists: **Trigger**, **Filter(s)**, **Steps** (in order), and **Field mappings**. Build and test each Zap with one dummy client before turning it on live. Turn each Zap on only after the one before it is tested — they chain.

App identifiers used below match what's live in the connected Zapier account: **Notion, Google Drive, Google Sheets, Google Calendar, Gmail, Slack, Webhooks by Zapier**, plus **Stripe** and **DocuSign**, which need to be connected first (Zapier → Apps → Connect).

---

## Zap 1 — "New Client → Contract Out"

**Trigger:** Webhooks by Zapier → Catch Hook (posted by your CRM/XLeads/form the instant a prospect is marked "Yes" — or use a native CRM trigger if your CRM has a Zapier integration instead of a webhook).

Payload expected: `client_name, client_email, company, service_package, price, payment_terms, account_manager, strategist, fulfillment_lead`.

**Steps:**
1. **DocuSign — Create & Send Envelope from Template.** Template = your reviewed legal contract (see `templates/contract-template.md` for the merge-field skeleton to build the DocuSign template from). Merge fields: `client_name`, `company`, `service_package`, `price`, `payment_terms`. Send immediately, no draft/review step.
2. **Notion — Create Database Item** in `Clients`: `Name` = client_name, `Email` = client_email, `Status` = `Contract Sent`, `Account Manager`/`Strategist`/`Fulfillment Lead` = from payload, `Package` = service_package.
3. **Slack — Send Channel Message** to `#new-clients`: "🎉 {{client_name}} ({{company}}) just said yes — contract sent for e-signature."

---

## Zap 2 — "Contract Signed"

**Trigger:** DocuSign → Envelope Completed.

**Steps:**
1. **Notion — Find Database Item** in `Clients` where `Email` = envelope recipient email.
2. **Notion — Update Database Item** → `Status` = `Signed`.
3. **Stripe — Create Invoice** (skip this step if the invoice was already sent alongside the contract): line item = service_package/price from the Notion record, `customer_email` = client email, due on receipt, auto-send enabled.

---

## Zap 3 — "Paid → Welcome + Access + Kickoff" (the core moment — must complete in under 60 seconds)

**Trigger:** Stripe → Payment Succeeded (Invoice).

**Filter:** Only continue if a matching `Clients` record exists with `Status` = `Signed` (prevents a stray/duplicate payment event from double-firing everything below).

**Steps (in this order — Drive/Slack/Calendar first so the links exist before the emails that reference them):**

1. **Notion — Find Database Item** in `Clients` by email.
2. **Google Drive — Copy File** (or "Create Folder from Template" if using a template folder ID) → duplicate the `Client Folder Template` folder, rename to `{{client_name}} — {{company}}`.
3. **Google Drive — Share File/Folder** → share the new folder with client email, role = `commenter` (not editor — keeps deliverables from being altered by the client).
4. **Slack — Invite User to Channel** (or **Create Channel** if you run one channel per client) → invite client email to `#client-{{client_name}}`.
5. **Notion — Share Page** (or add guest) → share the client's Portal page + relevant Project Board/Documents/Invoices views with client email.
6. **Google Calendar — Find Busy Periods** on both the client's calendar (from the payload/form, if captured) and the Account Manager's calendar for the next 5 business days.
7. **Google Calendar — Create Detailed Event** → "Kickoff Call — {{client_name}} x {{company}}", first mutual open 30-min slot from step 6, invite client email + Account Manager, add Google Meet link, set reminder 1 hour before.
8. **Formatter by Zapier — Utilities: Add/Subtract Time** → compute the WHAT/WHO/WHEN dates for the welcome letter: `kickoff_date` = step 7's event date, `brief_date` = kickoff_date, `first_deliverable_date` = kickoff_date + 5 business days (tune per package).
9. **Gmail — Send Email** → Welcome Letter (template in `templates/welcome-letter-template.md`), merged with client name, account manager/strategist/fulfillment initials, and the three dates from step 8. **This step is pure templating — no AI call, so wording is never a surprise.**
10. **Gmail — Send Email** → Tool Access email (template in `templates/tool-access-email-template.md`), merged with: Drive folder link (step 2/3), Slack invite/channel link (step 4), Notion portal link (step 5), resource library link (static).
11. **Notion — Update Database Item** → `Status` = `Onboarding`, `Drive Folder URL`, `Slack Channel`, `Kickoff Date`, `Portal URL` all written back from the steps above.

---

## Zap 4 — "Onboarding Form → AI Brief"

**Trigger:** Google Sheets → New Row (the sheet a Google Form for onboarding questions feeds — or Notion → New Database Item if using a Notion-native form).

Form should capture: `Goals, Budget, Timeline, Success Metrics, Target Audience, Current Pain Points, Prior Agency/Tool Experience` — full schema in `templates/onboarding-form-schema.md`.

**Steps:**
1. **Notion — Find Database Item** in `Clients` by email to pull `Company`, `Package`, `Account Manager`, `Strategist`, `Fulfillment Lead`, `Kickoff Date`.
2. **Webhooks by Zapier — POST** to `{{your deployed scripts/server.js URL}}/generate-brief` with JSON body: all form fields + the Notion fields from step 1.
3. **Notion — Create Database Item** in `AI Briefs`: relation to client, `Content` = response body's `brief` field, `Date Generated` = now.
4. **Google Drive — Create File from Text** → save the brief as a Doc inside the client's folder (from Zap 3), named `Brief — {{client_name}}.docx`.
5. **Notion — Find Database Items** in `Team Roster` where related to this client (Account Manager, Strategist, Fulfillment Lead, plus Designer/Media Buyer if assigned).
6. **Looping by Zapier** over step 5's results →
   7. **Gmail — Send Email** (or **Slack — Send Direct Message**) to each team member: subject "Brief: {{client_name}} — read before kickoff ({{kickoff_date}})", body = the brief content.

**Filter (recommended):** only run steps 2-7 if the form's submission timestamp is before the Notion record's `Kickoff Date` — if someone submits late, still generate the brief but flag `⚠️ Submitted after kickoff was scheduled` in the Slack notification instead of silently proceeding.

---

## Zap 5 — "Portal stays current" (no build needed)

Not a separate Zap. Because every prior Zap writes to the same `Clients`/`Project Board`/`Documents`/`Invoices` databases the portal reads from, and the fulfillment team updates task status directly in `Project Board` as they work, the client portal is live by construction. The only thing to set up once: share each client's portal page/views with their email (done in Zap 3, step 5).

---

## Zap 6 — "Monthly Report" (recurring)

**Trigger:** Schedule by Zapier → Every Month, day 1, 8:00 AM.

**Steps:**
1. **Notion — Find Database Items** in `Clients` where `Status` = `Active` (loop target).
2. **Looping by Zapier** over step 1's results →
   3. **Notion — Find Database Items** in `Project Board` where `Client` relation = current client AND `Completed Date` within the last 30 days (→ `completed_tasks`).
   4. **Notion — Find Database Items** in `Project Board` where `Client` relation = current client AND `Status` ≠ `Done` AND `Due Date` within the next 30 days (→ `upcoming_tasks`).
   5. **Notion — Find Database Item** in `AI Briefs` for this client (→ `original_goals`, for continuity in the report's "progress toward your goals" section).
   6. **Webhooks by Zapier — POST** to `{{server URL}}/generate-report` with `client_name, month, completed_tasks, upcoming_tasks, original_goals, account_manager`.
   7. **Google Drive — Create File from Text** → save as `Monthly Report — {{client_name}} — {{month}} {{year}}.docx` in the client's folder.
   8. **Notion — Create Database Item** in `Documents`: relation to client, `Type` = `Report`, link to the Drive file.
   9. **Gmail — Send Email** → report email (template in `templates/monthly-report-template.md`) to client, with the Drive doc linked and the report's summary inline in the email body.

---

## Guardrails to build in (not optional)

- **Idempotency filter on Zap 3:** Stripe can fire `payment_succeeded` more than once for the same invoice (retries). Add a filter: only proceed if `Clients.Status` is still `Signed` at the time the Zap runs (step 11 flips it to `Onboarding`, so a duplicate event stops at the filter).
- **Dead-letter alerting:** turn on Zapier's built-in "Zap fails → email/Slack me" notification on all 6 Zaps. A silent failure on Zap 3 is a client who paid and got nothing — the one failure mode this whole system exists to prevent.
- **Business-day math, not calendar-day math**, for every date in the welcome letter and Formatter steps — Fridays/weekends shouldn't produce "your kickoff call is tomorrow (Saturday)."
