// Claude-powered audit writer. Sends the crawl data + deterministic score to
// Claude with web search/fetch enabled so it can research the brand's search
// and AI-answer-engine footprint, then returns the 5-section Markdown report.
import Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';

import type { CrawlData } from './crawl';
import type { TechScore } from './score';

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Deepest analysis (default)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Faster, ~60% cheaper' },
] as const;
export type ModelId = (typeof MODELS)[number]['id'];

export type Source = { title: string; url: string };
export type AuditResult = { markdown: string; grade: string | null; score: number | null; sources: Source[] };

const SYSTEM_PROMPT = `You are an elite, AI-driven Chief Marketing Officer, Technical SEO Master, and Automation Architect.

Your task is to perform an exhaustive, multi-layered website audit of the URL the user provides. Analyze the target URL, its visible on-page content, its technical structure, and its modern search ecosystem footprint (standard search engines AND AI answer engines / GEO: ChatGPT, Perplexity, Gemini, Google AI Overviews).

You are given MEASURED crawl data collected directly from the site plus a deterministic technical score. Treat measured data as ground truth and cite specific numbers from it. Use web_fetch to read the page (and 1-2 key inner pages) and web_search to check: how the brand ranks for its core niche keywords, its Google Business Profile / reviews footprint, competitors ranking above it, and whether it is mentioned in sources AI answer engines draw on. Keep research focused - at most ~5 searches.

OUTPUT FORMAT - Markdown, exactly this structure:

The very first line must be exactly:
HEALTH_SCORE: <letter grade A+ to F> | <integer 0-100>/100

Then:

## Section 1: Executive Summary & Health Score
- **Overall Website Health Score:** grade and score (weigh modern web performance, mobile responsiveness, SEO readiness, GEO readiness). Briefly state how it relates to the measured technical score.
- **Core Summary:** exactly 3 sentences - what the site does right now, its primary visibility bottleneck, its biggest immediate growth opportunity.

## Section 2: Comprehensive Pros & Cons
### ✅ Pros (What's Working Well)
3-4 bullets, each with the evidence.
### ❌ Cons (Critical Flaws & Vulnerabilities)
3-4 bullets, each with the evidence and business impact.

## Section 3: Step-by-Step Guide to Scale Website Visits & Top Google Rankings
### Phase 1: Technical & On-Page Quick Wins (Days 1–14)
Numbered steps. Include a rewritten title tag, H1 and meta description for the homepage, written out in full.
### Phase 2: Content Authority & Keyword Gap Strategy (Days 15–30)
Name 1 pillar topic + 5-8 specific long-tail, high-intent keywords for this niche and location, and how to structure pages for Google AI Overviews (answer-first paragraphs, FAQ blocks, schema types to add).
### Phase 3: Backlink Acquisition & Authority Building (Days 31–60)
Specific digital PR angles, directories/citations and partner sites relevant to this niche, unlinked mention reclamation.

## Section 4: AI & Automation Growth Stack
### Technical & On-Page Execution Automation
### Content Optimization & Scaling
### AI Search (GEO) Visibility & Monitoring
### CRM & Lead Capture Workflow Automation
For each: 2-3 named tools, what exactly to automate with them for THIS site, and the ROI rationale.

## Section 5: High-Impact Action Plan Checklist
Exactly 5 items as "- [ ] " checkboxes, ranked by ROI, each doable this week, each with a one-line "why".

RULES: Professional, direct, authoritative, data-driven, ROI-focused. No generic filler - every recommendation must be tailored to this site's niche, location and measured data. Do not wrap the report in a code block. Do not add any preamble before the HEALTH_SCORE line or any commentary after Section 5.`;

function formatCrawl(c: CrawlData, t: TechScore | null): string {
  if (!c.ok) {
    return `On-device crawl FAILED (${c.error ?? `HTTP ${c.status}`}). Use web_fetch on the URL to gather on-page data yourself, and state which findings are inferred.`;
  }
  const checks = t
    ? t.checks.map((k) => `- [${k.pass ? 'PASS' : 'FAIL'}] ${k.category} · ${k.label}: ${k.detail}`).join('\n')
    : '';
  return `MEASURED CRAWL DATA
Final URL: ${c.finalUrl} (HTTP ${c.status}, ${c.responseMs} ms, ${Math.round(c.htmlBytes / 1024)} KB HTML)
Headers: ${JSON.stringify(c.headers)}
Title: ${c.title ?? '(missing)'}
Meta description: ${c.metaDescription ?? '(missing)'}
Meta robots: ${c.metaRobots ?? '(none)'} · Canonical: ${c.canonical ?? '(none)'} · lang: ${c.lang ?? '(none)'}
H1: ${JSON.stringify(c.h1)}
H2 (first 15): ${JSON.stringify(c.h2)}
H3 count: ${c.h3Count} · Word count: ${c.wordCount}
Schema types: ${c.schemaTypes.join(', ') || 'none'}
Images: ${c.images} (${c.imagesMissingAlt} missing alt) · Links: ${c.internalLinks} internal / ${c.externalLinks} external
Scripts: ${c.scripts} · Stylesheets: ${c.stylesheets} · Forms: ${c.forms} · tel: links ${c.phoneLinks} · mailto: ${c.emailLinks}
Detected stack/tracking: ${c.analytics.join(', ') || 'none'}
robots.txt: ${c.robots.found ? 'found' : 'missing'} · sitemap refs: ${c.robots.sitemapRefs.join(', ') || 'none'} · AI bots blocked: ${c.robots.blockedAiBots.join(', ') || 'none'}
Sitemap: ${c.sitemap.found ? `found, ${c.sitemap.urlCount} URLs` : 'not found'} · llms.txt: ${c.llmsTxt.found ? 'found' : 'not found'}

DETERMINISTIC TECHNICAL SCORE: ${t?.score}/100 (${t?.grade})
${checks}`;
}

export async function runAudit(opts: {
  apiKey: string;
  model: ModelId;
  url: string;
  context: string;
  crawl: CrawlData;
  tech: TechScore | null;
}): Promise<AuditResult> {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    // The key lives only on this device (SecureStore); there is no backend.
    dangerouslyAllowBrowser: true,
    timeout: 10 * 60 * 1000,
  });

  const userText = `Audit this website: ${opts.url}
${opts.context.trim() ? `Owner-provided context (niche / target market): ${opts.context.trim()}\n` : ''}
${formatCrawl(opts.crawl, opts.tech)}`;

  const messages: BetaMessageParam[] = [{ role: 'user', content: userText }];
  const blocks: BetaContentBlock[] = [];
  const isOpus = opts.model === 'claude-opus-5';

  // Server tools can pause a long turn (pause_turn); resume up to 4 times.
  for (let i = 0; i < 5; i++) {
    const response = await client.beta.messages.create({
      model: opts.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
      ],
      messages,
      // Opus 5: if a safety classifier declines, re-run on the recommended fallback model.
      ...(isOpus ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude declined this request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : '.'}`);
    }
    blocks.push(...response.content);
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content as BetaMessageParam['content'] });
  }

  const raw = blocks
    .filter((b): b is Extract<BetaContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const sources = new Map<string, Source>();
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) sources.set(r.url, { title: r.title, url: r.url });
    }
  }

  const m = raw.match(/HEALTH_SCORE:\s*([A-F][+-]?)\s*\|\s*(\d{1,3})\s*\/\s*100/i);
  // Drop anything before the report (and the machine-readable score line itself).
  const start = m ? raw.indexOf(m[0]) + m[0].length : raw.search(/^##\s/m);
  const markdown = (start > 0 ? raw.slice(start) : raw).trim();

  if (!markdown) throw new Error('Claude returned an empty report. Try again.');
  return {
    markdown,
    grade: m ? m[1].toUpperCase() : null,
    score: m ? Math.min(100, Number(m[2])) : null,
    sources: [...sources.values()].slice(0, 20),
  };
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Invalid Anthropic API key. Update it in Settings.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to that model or feature.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API. Wait a minute and try again.';
  if (e instanceof Anthropic.BadRequestError) return `Request rejected: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'The audit timed out. Try again or switch to Sonnet 5 in Settings.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.';
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
