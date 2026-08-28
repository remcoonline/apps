/**
 * ZAPIER "Code by Zapier" STEP — Run Javascript
 * Step: "Generate HTML Template via Claude API"
 *
 * WHERE THIS RUNS
 * Paste this whole file into a "Code by Zapier" -> "Run Javascript" action step.
 * Zapier injects two variables into scope for you: `inputData` (the fields you map
 * in the step editor) and `z` (Zapier's request/logging/error helper). Do not
 * redeclare either of them.
 *
 * MANUAL CONFIGURATION REQUIRED (do this in the Zapier step editor, not in code):
 *   1. Add an Input Data field named `templateDescription` -> map to the sanitized
 *      description from the "Parse & Validate" step.
 *   2. Add `cssFramework` and `templateVariant` -> map to the validated step-1 output
 *      (defaults are handled below if they're blank).
 *   3. Add `claudeApiKey` -> map this to a value pulled from "Storage by Zapier"
 *      (or a masked/sensitive custom field) — NEVER hardcode the key below and
 *      NEVER paste the literal key into the Zapier field mapper UI in plaintext
 *      if a secrets-manager option is available on your plan.
 *
 * SECURITY
 *   - The API key only ever lives in `inputData.claudeApiKey`, sourced from Storage
 *     by Zapier. It is never logged, never written to the output object.
 *   - `z.console.log` calls below intentionally omit the key and any raw HTML body
 *     content beyond short length summaries.
 */

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s
const REQUEST_TIMEOUT_MS = 55000; // stay under Zapier's step execution ceiling

// System prompt — kept verbatim/exact per spec. Edit here (not per-call) if the
// generation quality needs tuning; every Zap run uses this same instruction set.
const SYSTEM_PROMPT = `You are an expert web designer and frontend developer. Your task is to generate a production-ready HTML/CSS website template based on user descriptions.

Guidelines:
1. Return ONLY valid HTML with inline <style> tags
2. Mobile-first responsive design
3. Semantic HTML5 structure
4. Modern CSS3 (flexbox/grid)
5. Include relevant placeholder content
6. Ensure accessibility (alt text, semantic tags, proper contrast)
7. No external dependencies unless requested
8. No markdown, explanations, or comments — HTML code only
9. Professional, polished design
10. Include footer with edit instructions for customization

Generate the complete HTML file ready for deployment.`;

/**
 * Extensibility hook: builds the user-facing instruction sent alongside the
 * system prompt. Add new optional inputData fields (e.g. brandColors,
 * targetAudience) here without touching the rest of the pipeline.
 */
function buildUserMessage(input) {
  const parts = [`Website description: ${input.templateDescription}`];

  if (input.templateVariant && input.templateVariant !== 'general') {
    parts.push(`Template type/variant: ${input.templateVariant}`);
  }

  if (input.cssFramework && input.cssFramework !== 'none') {
    parts.push(
      `CSS framework requested: ${input.cssFramework}. You may use its CDN <link>/<script> ` +
      `tag if that is more idiomatic than hand-written inline styles for this framework.`
    );
  }

  return parts.join('\n');
}

/** Basic input validation/sanitization — fail fast with a clear message. */
function validateInput(inputData) {
  const description = (inputData.templateDescription || '').toString().trim();

  if (!description) {
    throw new Error('VALIDATION_FAILED: templateDescription is required.');
  }
  if (description.length < 10) {
    throw new Error('VALIDATION_FAILED: templateDescription is too short to generate a meaningful template.');
  }
  if (description.length > 4000) {
    throw new Error('VALIDATION_FAILED: templateDescription exceeds 4000 characters.');
  }
  if (!inputData.claudeApiKey) {
    throw new Error('CONFIG_ERROR: claudeApiKey is missing. Map it from Storage by Zapier in the step editor.');
  }

  // Strip control characters to prevent log/prompt injection via odd chatbot input.
  // eslint-disable-next-line no-control-regex
  const sanitizedDescription = description.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return {
    templateDescription: sanitizedDescription,
    cssFramework: (inputData.cssFramework || 'none').toString().trim().toLowerCase(),
    templateVariant: (inputData.templateVariant || 'general').toString().trim().toLowerCase(),
    claudeApiKey: inputData.claudeApiKey,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the Anthropic Messages API via z.request, with retry/backoff for
 * transient failures only. Non-retryable client errors (bad request, bad key,
 * content policy) fail immediately since retrying can't fix them.
 */
async function callClaudeWithRetry(input) {
  const requestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserMessage(input),
      },
    ],
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      z.console.log(`[claude] attempt ${attempt}/${MAX_RETRIES} — description length ${input.templateDescription.length}`);

      const response = await z.request({
        url: ANTHROPIC_ENDPOINT,
        method: 'POST',
        headers: {
          'x-api-key': input.claudeApiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: requestBody,
        timeout: REQUEST_TIMEOUT_MS,
        // Let us inspect non-2xx responses ourselves instead of z.request throwing.
        skipThrowForStatus: true,
      });

      const status = response.status;

      if (status >= 200 && status < 300) {
        return response.json ? response.json() : JSON.parse(response.content);
      }

      const bodyText = response.content || '';
      const retryable = status === 429 || status >= 500;

      lastError = new Error(`CLAUDE_API_FAILED: HTTP ${status} — ${bodyText.slice(0, 300)}`);

      if (!retryable) {
        throw lastError; // 400/401/403/404 — no point retrying
      }

      z.console.log(`[claude] retryable error on attempt ${attempt}: HTTP ${status}`);
    } catch (err) {
      lastError = err;
      // z.request itself can throw on network-level failures (timeout, DNS, etc).
      // Treat those as retryable too.
    }

    if (attempt < MAX_RETRIES) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }

  throw lastError || new Error('CLAUDE_API_FAILED: exhausted retries with no captured error.');
}

/** Pulls the HTML text out of Claude's content blocks and does a sanity check. */
function extractHtml(claudeResponse) {
  const blocks = (claudeResponse && claudeResponse.content) || [];
  const textBlock = blocks.find((b) => b.type === 'text');

  if (!textBlock || !textBlock.text) {
    throw new Error('CLAUDE_API_FAILED: response contained no text content block.');
  }

  let html = textBlock.text.trim();

  // Defensive cleanup: strip accidental markdown code fences even though the
  // system prompt forbids them — chatbots/users sometimes push Claude off-spec.
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();

  if (!/^<!DOCTYPE html>/i.test(html) && !/<html[\s>]/i.test(html)) {
    throw new Error('CLAUDE_API_FAILED: generated content does not look like a valid HTML document.');
  }

  return html;
}

// ---- Main entry point -----------------------------------------------------
// Zapier wraps this file's top-level code in an async function for you, so a
// top-level `await` and `return` both work here.

const validated = validateInput(inputData);
const claudeResponse = await callClaudeWithRetry(validated);
const html = extractHtml(claudeResponse);

const output = {
  html,
  model: claudeResponse.model || MODEL,
  inputTokens: (claudeResponse.usage && claudeResponse.usage.input_tokens) || null,
  outputTokens: (claudeResponse.usage && claudeResponse.usage.output_tokens) || null,
  generatedAt: new Date().toISOString(),
};

z.console.log(`[claude] success — generated ${html.length} chars of HTML, output_tokens=${output.outputTokens}`);

return output;
