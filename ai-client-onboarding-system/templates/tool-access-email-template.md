# Tool Access Email — template (Zap 3, step 10)

**Subject:** You're in — all your links in one place

---

Hi {{client_name}},

Everything you need is ready right now. Bookmark this email.

- 📁 **Shared Drive** (your documents, deliverables, contracts): {{drive_folder_link}}
- 💬 **Team Chat** (direct line to your account team): {{slack_invite_link}}
- 📊 **Project Board** (live status of every piece of work — always current, no need to ask): {{portal_project_board_link}}
- 📚 **Resource Library** (guides, FAQs, everything we've learned works): {{resource_library_link}}
- 🧾 **Invoices**: {{portal_invoices_link}}

Everything above lives in one place — your Client Portal: {{portal_url}}

See you at kickoff on {{kickoff_date}}.

{{account_manager_full_name}}
{{company_legal_name}}

---

### Merge fields

`client_name`, `drive_folder_link`, `slack_invite_link`, `portal_project_board_link`, `resource_library_link`, `portal_invoices_link`, `portal_url`, `kickoff_date`, `account_manager_full_name`, `company_legal_name` — all supplied by Zap 3 from the Drive/Slack/Notion/Calendar steps that ran immediately before this one.
