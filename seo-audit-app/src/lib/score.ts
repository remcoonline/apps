// Deterministic technical-readiness score. Every point comes from a measured
// signal in CrawlData, so the number is reproducible and not model-generated.
import type { CrawlData } from './crawl';

export type Check = {
  id: string;
  category: 'Technical' | 'On-Page' | 'AI Search (GEO)' | 'Conversion';
  label: string;
  pass: boolean;
  weight: number;
  detail: string;
};

export type TechScore = { score: number; grade: string; checks: Check[] };

export function gradeFor(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

export function scoreCrawl(c: CrawlData): TechScore | null {
  if (!c.ok) return null;
  const titleLen = c.title?.length ?? 0;
  const descLen = c.metaDescription?.length ?? 0;
  const noindex = /noindex/i.test(c.metaRobots ?? '') || /noindex/i.test(c.headers['x-robots-tag'] ?? '');
  const altRatio = c.images ? c.imagesMissingAlt / c.images : 0;

  const checks: Check[] = [
    { id: 'https', category: 'Technical', label: 'Served over HTTPS', pass: c.https, weight: 8, detail: c.finalUrl },
    {
      id: 'redirect',
      category: 'Technical',
      label: 'HTTP redirects to HTTPS',
      pass: c.httpRedirectsToHttps !== false,
      weight: 3,
      detail: c.httpRedirectsToHttps === null ? 'Could not verify' : c.httpRedirectsToHttps ? 'Yes' : 'No redirect',
    },
    {
      id: 'speed',
      category: 'Technical',
      label: 'Server response under 1.5s',
      pass: (c.responseMs ?? 99999) < 1500,
      weight: 7,
      detail: `${c.responseMs ?? '?'} ms from this device (network-dependent)`,
    },
    {
      id: 'weight',
      category: 'Technical',
      label: 'HTML under 500 KB',
      pass: c.htmlBytes < 500_000,
      weight: 3,
      detail: `${Math.round(c.htmlBytes / 1024)} KB, ${c.scripts} scripts`,
    },
    { id: 'viewport', category: 'Technical', label: 'Mobile viewport tag', pass: c.hasViewport, weight: 6, detail: c.hasViewport ? 'Present' : 'Missing' },
    { id: 'indexable', category: 'Technical', label: 'Page is indexable', pass: !noindex && !c.robots.disallowAll, weight: 8, detail: noindex ? 'noindex set' : c.robots.disallowAll ? 'robots.txt blocks all' : 'Indexable' },
    { id: 'robots', category: 'Technical', label: 'robots.txt present', pass: c.robots.found, weight: 3, detail: c.robots.found ? 'Found' : `Missing (${c.robots.status ?? 'no response'})` },
    {
      id: 'sitemap',
      category: 'Technical',
      label: 'XML sitemap present',
      pass: c.sitemap.found,
      weight: 5,
      detail: c.sitemap.found ? `${c.sitemap.urlCount} URLs listed` : 'Not found',
    },
    { id: 'canonical', category: 'Technical', label: 'Canonical tag', pass: !!c.canonical, weight: 3, detail: c.canonical ?? 'Missing' },
    {
      id: 'title',
      category: 'On-Page',
      label: 'Title tag 30–60 characters',
      pass: titleLen >= 30 && titleLen <= 60,
      weight: 7,
      detail: c.title ? `"${c.title}" (${titleLen})` : 'Missing',
    },
    {
      id: 'desc',
      category: 'On-Page',
      label: 'Meta description 70–160 characters',
      pass: descLen >= 70 && descLen <= 160,
      weight: 5,
      detail: c.metaDescription ? `${descLen} characters` : 'Missing',
    },
    { id: 'h1', category: 'On-Page', label: 'Exactly one H1', pass: c.h1.length === 1, weight: 6, detail: c.h1.length ? c.h1.map((h) => `"${h}"`).join(', ') : 'No H1' },
    { id: 'h2', category: 'On-Page', label: 'H2 subheadings structure content', pass: c.h2.length >= 2, weight: 3, detail: `${c.h2.length} H2, ${c.h3Count} H3` },
    { id: 'words', category: 'On-Page', label: 'At least 500 words of content', pass: c.wordCount >= 500, weight: 6, detail: `${c.wordCount} words` },
    { id: 'alt', category: 'On-Page', label: 'Images have alt text', pass: altRatio <= 0.1, weight: 3, detail: `${c.imagesMissingAlt}/${c.images} missing alt` },
    { id: 'links', category: 'On-Page', label: '10+ internal links', pass: c.internalLinks >= 10, weight: 3, detail: `${c.internalLinks} internal, ${c.externalLinks} external` },
    { id: 'og', category: 'On-Page', label: 'Open Graph tags (social previews)', pass: c.openGraph.title && c.openGraph.image, weight: 2, detail: `title ${c.openGraph.title ? '✓' : '✗'} · image ${c.openGraph.image ? '✓' : '✗'}` },
    { id: 'lang', category: 'On-Page', label: 'HTML lang attribute', pass: !!c.lang, weight: 1, detail: c.lang ?? 'Missing' },
    {
      id: 'schema',
      category: 'AI Search (GEO)',
      label: 'Structured data (schema.org)',
      pass: c.schemaTypes.length > 0,
      weight: 7,
      detail: c.schemaTypes.length ? c.schemaTypes.join(', ') : 'None found',
    },
    {
      id: 'aibots',
      category: 'AI Search (GEO)',
      label: 'AI crawlers allowed',
      pass: c.robots.blockedAiBots.length === 0,
      weight: 4,
      detail: c.robots.blockedAiBots.length ? `Blocked: ${c.robots.blockedAiBots.join(', ')}` : 'None blocked',
    },
    { id: 'llms', category: 'AI Search (GEO)', label: 'llms.txt published', pass: c.llmsTxt.found, weight: 2, detail: c.llmsTxt.found ? 'Found' : 'Not found' },
    {
      id: 'contact',
      category: 'Conversion',
      label: 'Click-to-call or lead form',
      pass: c.phoneLinks > 0 || c.forms > 0,
      weight: 3,
      detail: `${c.phoneLinks} tel: links, ${c.forms} forms`,
    },
    { id: 'tracking', category: 'Conversion', label: 'Analytics / tracking installed', pass: c.analytics.some((a) => /Analytics|Tag Manager|Pixel|Clarity|Hotjar|HubSpot|GoHighLevel/.test(a)), weight: 1, detail: c.analytics.join(', ') || 'None detected' },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  const score = Math.round((earned / total) * 100);
  return { score, grade: gradeFor(score), checks };
}
