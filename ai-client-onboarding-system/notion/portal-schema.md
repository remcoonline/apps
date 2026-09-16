# Notion Databases — the client portal's system of record

Create these six databases in one Notion workspace/page (e.g. `📁 Client Operations`). Relations link them together; the portal itself is just filtered views into these databases, shared per client.

## 1. `Clients` — the spine

| Property | Type | Notes |
|---|---|---|
| Name | Title | Client's full name |
| Company | Text | |
| Email | Email | Used to match every Zapier "Find Record" step |
| Status | Select | `Contract Sent`, `Signed`, `Paid`, `Onboarding`, `Active`, `Completed`, `Churned` |
| Package | Select | Which service package |
| Account Manager | Relation → Team Roster | |
| Strategist | Relation → Team Roster | |
| Fulfillment Lead | Relation → Team Roster | |
| Kickoff Date | Date | Written by Zap 3 |
| Drive Folder URL | URL | Written by Zap 3 |
| Slack Channel | Text | Written by Zap 3 |
| Portal URL | URL | This client's portal page |
| Contract Signed Date | Date | Written by Zap 2 |
| First Paid Date | Date | Written by Zap 3 |

## 2. `Team Roster`

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Initials | Text | e.g. `AM`, `SJ`, `DK` — used in the welcome letter table |
| Role | Select | Account Manager / Strategist / Fulfillment Lead / Designer / Media Buyer |
| Email | Email | Zap 4 loops over this to deliver the AI Brief |
| Slack Member ID | Text | For DM delivery instead of email, if preferred |

## 3. `Project Board`

| Property | Type | Notes |
|---|---|---|
| Task | Title | |
| Client | Relation → Clients | |
| Owner | Relation → Team Roster | |
| Status | Select | `Not started`, `In progress`, `Done` |
| Due Date | Date | |
| Completed Date | Date | Zap 6 filters on this for "what got done this month" |

This is what the client sees as **live status of all work** — the team updates it as they go, no separate status-update step required.

## 4. `Documents`

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Client | Relation → Clients | |
| Type | Select | `Contract`, `Brief`, `Report`, `Deliverable` |
| File / Link | Files & media or URL | Drive link |
| Date | Date (created time) | |

## 5. `Invoices`

| Property | Type | Notes |
|---|---|---|
| Invoice # | Title | |
| Client | Relation → Clients | |
| Amount | Number (currency) | |
| Status | Select | `Sent`, `Paid`, `Overdue` |
| Stripe Link | URL | |
| Date | Date | |

## 6. `AI Briefs`

| Property | Type | Notes |
|---|---|---|
| Client | Relation → Clients (title-style, one per client) | |
| Content | Text (long) | The generated brief markdown |
| Success Checklist | Text or To-do blocks in the page body | Pulled straight from the brief's "Success Looks Like…" section |
| Date Generated | Date | |

## 7. `Onboarding Form Responses`

| Property | Type | Notes |
|---|---|---|
| Client | Relation → Clients | |
| Goals | Text | |
| Budget | Text | |
| Timeline | Text | |
| Success Metrics | Text | |
| Target Audience | Text | |
| Pain Points | Text | |
| Prior Experience | Text | |
| Submitted | Date (created time) | |

## The portal page itself

One **template page** (e.g. `Client Portal — Template`) containing three linked-database views, each filtered to `Client = current page's related client`:
- **Documents** view (gallery or table)
- **Project Board** view (board, grouped by Status)
- **Invoices** view (table)

Duplicate this page per client (or use Notion's page-linked-to-database-item pattern), share it with the client's email as a guest with `Can view` (or `Can comment`) access. Zap 3 step 5 handles the sharing automatically once the page exists — Notion doesn't support template-instantiation via the API in the same call as sharing, so keep the per-client portal pages pre-created as soon as a `Clients` row exists (Zap 1 can create the portal page, not just the database row, if you want this fully automatic from day one — add a "Notion: Create Page" step to Zap 1 using the template page's ID as `parent`).
