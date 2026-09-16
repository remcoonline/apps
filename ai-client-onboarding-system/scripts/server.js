const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY — set it in .env before starting.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const briefSystemPrompt = fs.readFileSync(
  path.join(__dirname, 'prompts', 'brief-system-prompt.txt'),
  'utf8'
);
const reportSystemPrompt = fs.readFileSync(
  path.join(__dirname, 'prompts', 'report-system-prompt.txt'),
  'utf8'
);

const app = express();
app.use(express.json());

// Zapier's "Webhooks by Zapier" POST step should send this header, set to
// the same value as WEBHOOK_SECRET, so this endpoint isn't callable by
// anyone who finds the URL. Skipped only if WEBHOOK_SECRET is left unset.
function requireSecret(req, res, next) {
  if (!WEBHOOK_SECRET) return next();
  if (req.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

async function generate(systemPrompt, userPayload) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
  });
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

app.post('/generate-brief', requireSecret, async (req, res) => {
  try {
    const brief = await generate(briefSystemPrompt, req.body);
    res.json({ brief });
  } catch (err) {
    console.error('generate-brief failed:', err);
    res.status(502).json({ error: 'brief generation failed' });
  }
});

app.post('/generate-report', requireSecret, async (req, res) => {
  try {
    const report = await generate(reportSystemPrompt, req.body);
    res.json({ report });
  } catch (err) {
    console.error('generate-report failed:', err);
    res.status(502).json({ error: 'report generation failed' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`AI onboarding service listening on :${PORT}`);
});
