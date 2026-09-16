# Monthly Report Email — template (Zap 6, step 9)

**Subject:** Your {{month}} report — what we got done and what's next

---

Hi {{client_name}},

Your {{month}} report is ready — full version attached/linked below, summary here:

{{ai_generated_report_body}}

Full report with details: {{drive_report_link}}
Live status any time: {{portal_url}}

Talk soon,
{{account_manager_full_name}}
{{company_legal_name}}

---

### Merge fields

`client_name`, `month`, `ai_generated_report_body` (the markdown returned from `POST /generate-report`, converted to email-safe HTML by a Formatter step or Gmail's markdown rendering), `drive_report_link`, `portal_url`, `account_manager_full_name`, `company_legal_name`.

`ai_generated_report_body` is the only AI-written content in this email — subject, greeting, and sign-off are fixed so the email always feels consistent even as report content varies month to month.
