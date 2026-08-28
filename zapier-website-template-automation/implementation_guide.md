# Implementation Guide — AI Website Template Generator

This guide walks a non-technical founder through building the full Zap described
in `zapier_zap_config.json`, wiring it to GoHighLevel (GHL) and GitHub, and
testing/monitoring it end-to-end. Read the other five files alongside this one:

| File | Purpose |
|---|---|
| `zapier_zap_config.json` | Blueprint of the Zap's trigger + 4 steps |
| `claude_api_integration.js` | Code for Step 2 (Claude API call) |
| `github_file_creator.js` | Code for Step 3 (GitHub commit) |
| `ghl_webhook_payload.json` | Exact payload shape + GHL setup notes |
| `email_template.html` | Confirmation email body for Step 4 |

---

## 0. Prerequisites

- **Zapier plan** that supports multi-step Zaps and "Code by Zapier" (Professional
  tier or higher on most Zapier plans).
- **GoHighLevel** account with access to Workflows and (if using it) Conversational AI / Chatbot.
- **Anthropic API key** — create one at console.anthropic.com. Note your billing/rate limits.
- **GitHub Personal Access Token(s)** — for the MVP, each user supplies their own
  fine-grained PAT scoped to a single repo with **Contents: Read and write** only.
- A place to store secrets outside of plain-text Zap fields: **Storage by Zapier**
  (built into every Zapier account) is used throughout this guide for the
  Anthropic key and the shared webhook secret.

---

## 1. Create the Zap and the trigger

1. In Zapier, click **Create Zap**.
2. Search for the trigger app **Webhooks by Zapier** and choose the event
   **Catch Raw Hook** (this preserves headers, which we need for the shared-secret check).
3. Zapier generates a unique webhook URL — copy it. This is what GHL will POST to.
4. Leave the trigger step's test data empty for now; you'll send a real test payload from GHL in Step 3 below.

---

## 2. Store your secrets in Storage by Zapier

Before building the Code steps, stash two values so they never live in plain Zap fields:

1. Add a one-off **Storage by Zapier** action anywhere temporarily (or use the
   Storage by Zapier UI directly at zapier.com/app/storage) to set:
   - Key `anthropic_api_key` → your Claude API key.
   - Key `ghl_webhook_shared_secret` → a random string you generate (e.g. a UUID).
2. Delete the temporary action step once the values are saved — you only needed it to write them once.
3. In later Code steps, read these back with:
   ```js
   const secret = await z.storage.get('anthropic_api_key');
   ```
   (Note: `z.storage` is scoped per-Zap by default in Zapier's Code steps — confirm this behavior on your plan, or use the Storage by Zapier *action* step instead and pass the value in as an Input Data field if `z.storage` isn't available in your account's Code step runtime.)

---

## 3. Configure the GoHighLevel chatbot workflow

Follow `ghl_webhook_payload.json`'s `ghl_configuration_notes` section in detail. Summary:

1. Build (or extend) a GHL Conversational AI / Chatbot flow that asks the user
   to describe the website they want, and optionally pick a CSS framework / template type.
2. Collect `github_credentials.owner`, `.repo`, and `.personal_access_token` as
   **Contact custom fields**, set up once during onboarding — not re-asked every chat.
   See the **Security** callout below before wiring up token collection.
3. Add a final **Webhook** action to the workflow:
   - Method: `POST`
   - URL: the Zapier webhook URL from Step 1.
   - Content-Type: `application/json`
   - Body: match `ghl_webhook_payload.json`'s `sample_payload` shape exactly, using GHL merge fields.
   - Header: `X-Webhook-Secret: <the value you stored as ghl_webhook_shared_secret>`
4. Use GHL's "Test Workflow" feature to fire one real request and confirm it lands in Zapier's trigger test data (back in the Zap editor, click "Test trigger").

> **Security callout:** collecting a raw GitHub PAT through a chatbot means it
> passes through GHL's conversation/workflow logs in plaintext. For the MVP this
> is accepted as a known risk (documented in `ghl_webhook_payload.json`), scoped
> down by using a fine-grained, single-repo, contents-only token. Plan to replace
> this with a GitHub App OAuth install flow before scaling past early users.

---

## 4. Step 1 — Parse & Validate (Code by Zapier)

1. Add a step: **Code by Zapier → Run Javascript**.
2. Map Input Data fields from the trigger step (exact paths in `zapier_zap_config.json` under `steps[0].input_fields`), including the `X-Webhook-Secret` header.
3. Write validation code that:
   - Compares the incoming secret header against `ghl_webhook_shared_secret`.
   - Validates required fields and types per `ghl_webhook_payload.json`'s `field_schema`.
   - Throws a descriptive `Error` (shows up in Zap History) if anything is invalid.
   - Returns a clean object (`isValid`, `sanitizedDescription`, `cssFramework`, `templateVariant`, `githubOwner`, `githubRepo`, `githubBranch`, `contactEmail`, `contactName`).
4. Click **Test step** and confirm it returns the expected clean object using the real GHL test payload from Step 3.

---

## 5. Step 2 — Generate HTML via Claude (Code by Zapier)

1. Add a step: **Code by Zapier → Run Javascript**.
2. Paste the full contents of `claude_api_integration.js`.
3. Map Input Data:
   - `templateDescription` → Step 1 output `sanitizedDescription`
   - `cssFramework` → Step 1 output `cssFramework`
   - `templateVariant` → Step 1 output `templateVariant`
   - `claudeApiKey` → `{{z.storage.get('anthropic_api_key')}}` if your plan surfaces that in the mapper, otherwise fetch it inside the code via `await z.storage.get(...)` as shown in Section 2.
4. Click **Test step**. Confirm you get back `html` (starts with `<!DOCTYPE html>` or `<html`), `model`, token counts, and `generatedAt`.
5. If the test fails, check the step's logs (`z.console.log` output is visible there) for the exact HTTP status Claude returned — 401 means bad key, 429 means you're rate-limited (the retry logic will have already tried 3 times), 400 usually means a malformed request body.

---

## 6. Step 3 — Commit to GitHub (Code by Zapier)

1. Add a step: **Code by Zapier → Run Javascript**.
2. Paste the full contents of `github_file_creator.js`.
3. Map Input Data:
   - `html` → Step 2 output `html`
   - `githubToken`, `githubOwner`, `githubRepo`, `githubBranch` → Step 1 output
   - `templateDescription` → Step 1 output `sanitizedDescription`
4. Click **Test step**. Confirm it returns `commitUrl`, `fileUrl`, `rawUrl`, `filePath`, `commitSha`.
5. Open `fileUrl` in a browser to confirm the file actually landed in `templates/` in the target repo.
6. Common failures: `GITHUB_AUTH_FAILED` (bad/expired token or wrong scopes), `GITHUB_REPO_NOT_FOUND` (typo in owner/repo, or token can't see a private repo), `GITHUB_FORBIDDEN` (rate limit — check the `X-RateLimit-Reset` value in the raw response if this recurs).

---

## 7. Step 4 — Send the confirmation email

1. Add a step using **Email by Zapier** (simplest, no extra account needed) or your preferred provider (Gmail, SendGrid) if you want a branded "from" address.
2. Set:
   - To: Step 1 output `contactEmail`
   - Subject: `Your AI-generated website template is ready!`
   - Body (HTML): paste `email_template.html`.
3. Replace each `{{placeholder}}` in the pasted HTML using Zapier's field mapper (click into the body field, delete the placeholder text, insert the matching upstream field) per the mapping table at the top of `email_template.html`.
4. Click **Test step** and check the actual inbox — verify the buttons link to the real GitHub URLs and the email doesn't land in spam (see monitoring section for SPF/DKIM notes).

---

## 8. Optional: error-handling path

1. Turn on Zapier's built-in **"Zap failed" email alerts** (Zap settings → Notifications) so you (the founder) hear about failures immediately.
2. For a more polished failure experience, add **Paths by Zapier** after Step 1 branching on `isValid`:
   - Path A (valid): continues to Steps 2-4 as above.
   - Path B (invalid): sends a short "we couldn't process that request" email back to the contact, referencing `meta.conversation_id` so support can look it up.
3. Consider a Slack/Email step wired to Zapier's error webhook (via a second, error-only Zap watching Zap History via the Zapier API) for full visibility once volume grows.

---

## 9. End-to-end testing checklist

- [ ] Fire a real message through the live GHL chatbot (not just Zapier's test data) and confirm all 4 steps run.
- [ ] Verify the generated HTML renders correctly by opening the raw GitHub URL in a browser.
- [ ] Verify the commit appears in the repo's commit history with the expected message.
- [ ] Verify the confirmation email arrives, is not in spam, and every link works.
- [ ] Test a **failure path** deliberately: submit an empty description, or an invalid GitHub token, and confirm Step 1/Step 3 fail with a clear error in Zap History (not a silent hang).
- [ ] Test with a description close to the 2000-character limit to confirm truncation/validation behaves as expected.
- [ ] Confirm no secrets (API key, PAT) appear anywhere in Zap History step logs.

---

## 10. Monitoring & debugging

- **Zap History** (Zapier dashboard → your Zap → History) shows every run, its status, and each step's input/output — this is your first stop for any reported issue.
- **Step logs**: the `z.console.log(...)` lines in both Code steps show up per-run in Zap History, giving attempt counts, response sizes, and non-secret diagnostic info without exposing keys.
- **Anthropic Console** (console.anthropic.com) → usage dashboard: watch token consumption and rate-limit headroom as volume grows; the retry logic in `claude_api_integration.js` will absorb occasional 429s but sustained rate-limiting means it's time to request a higher tier.
- **GitHub**: watch the target repos' commit history and, for shared/org repos, the PAT's last-used timestamp (Settings → Developer settings → Personal access tokens) to catch a token that's stopped working.
- **Email deliverability**: if using a custom "from" domain, set up SPF/DKIM/DMARC records for that domain so confirmation emails don't land in spam; Email by Zapier's shared sending domain handles this for you automatically.
- **Cost/rate-limit awareness**: each run costs one Claude API call (~4096 max output tokens) and consumes one GitHub API request; both are well within free/low tiers for early volume, but revisit as the Pro/Creator tiers gain users.

---

## 11. Where Phase 2 (Solana) plugs in

Per `zapier_zap_config.json`'s `extensibility_notes`, add a new Code-by-Zapier
step immediately after Step 3 that:
1. Pins the committed HTML (or its GitHub raw URL's content) to IPFS/Arweave.
2. Calls a Solana program to mint a fractional-ownership NFT referencing that content hash.
3. Persists the mint address next to the GitHub commit metadata (Storage by
   Zapier for low volume, or a proper database once the marketplace launches)
   so revenue-share calculations for the 20+-contributor marketplace tier have
   a source of truth to read from.

No changes are needed to Steps 1-4 to support this — `cssFramework` and
`templateVariant` are already threaded through specifically so new template
types and the Phase 2 minting step can be added without re-wiring the core pipeline.
