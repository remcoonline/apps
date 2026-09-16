# Welcome Letter — email template (Zap 3, step 9)

**Subject:** Welcome aboard, {{client_name}} — here's exactly what happens next

---

Hi {{client_name}},

Welcome to {{company_legal_name}}! Your contract is signed, your first invoice is paid, and your project is officially live. Here's exactly what happens next — no guesswork, no waiting to hear from us.

| WHAT | WHO | WHEN |
|---|---|---|
| Kickoff call | {{account_manager_initials}} | {{kickoff_date}} |
| Strategy brief | {{strategist_initials}} | {{brief_date}} |
| First deliverable | {{fulfillment_lead_initials}} | {{first_deliverable_date}} |

Your kickoff call is already on your calendar (check your invite from {{account_manager_initials}}) — you don't need to book anything.

You'll get a separate email in the next minute with your tool access (shared drive, team chat, project board, and resource library) so you can look around before the call.

Any question at all, just reply to this email — it goes straight to {{account_manager_initials}}.

Glad you're here,
{{account_manager_full_name}}
{{company_legal_name}}

---

### Merge fields

`client_name`, `company_legal_name`, `account_manager_initials`, `strategist_initials`, `fulfillment_lead_initials`, `account_manager_full_name`, `kickoff_date`, `brief_date`, `first_deliverable_date` — all supplied by Zap 3 (dates from the Formatter step, names/initials from the `Clients`/`Team Roster` lookup). No AI call needed for this email — pure deterministic merge, so the commitment dates are never a hallucination risk.
