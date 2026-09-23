// On-device crawler: fetches the page plus robots.txt, sitemap.xml and llms.txt
// and extracts the technical/on-page signals the audit is built on.
// Native fetch (iOS/Android) has no CORS limits; in a web browser most sites
// will block these requests, in which case Claude falls back to web_fetch.

export type ProbeResult = { found: boolean; status: number | null; bytes: number };

export type CrawlData = {
  inputUrl: string;
  finalUrl: string;
  ok: boolean;
  error?: string;
  status: number | null;
  responseMs: number | null;
  htmlBytes: number;
  https: boolean;
  httpRedirectsToHttps: boolean | null;
  headers: Record<string, string>;
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  lang: string | null;
  hasViewport: boolean;
  hasFavicon: boolean;
  openGraph: { title: boolean; description: boolean; image: boolean };
  twitterCard: boolean;
  h1: string[];
  h2: string[];
  h3Count: number;
  schemaTypes: string[];
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  scripts: number;
  stylesheets: number;
  forms: number;
  phoneLinks: number;
  emailLinks: number;
  hreflangCount: number;
  analytics: string[];
  robots: ProbeResult & { sitemapRefs: string[]; blockedAiBots: string[]; disallowAll: boolean };
  sitemap: ProbeResult & { urlCount: number };
  llmsTxt: ProbeResult;
};

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'];
const UA = 'Mozilla/5.0 (compatible; SiteAuditAI/1.0; +https://github.com/remcoonline/apps)';
const TIMEOUT_MS = 20000;

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  return parsed.toString();
}

async function timedFetch(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url: string): Promise<ProbeResult & { text: string }> {
  try {
    const res = await timedFetch(url);
    const text = res.ok ? await res.text() : '';
    // Many sites serve their HTML 404 page with a 200 for missing files.
    const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text);
    const found = res.ok && text.length > 0 && !looksLikeHtml;
    return { found, status: res.status, bytes: text.length, text: found ? text : '' };
  } catch {
    return { found: false, status: null, bytes: 0, text: '' };
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, ' '));

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function metaContent(html: string, key: string, keyAttr = 'name'): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, keyAttr)?.toLowerCase() === key) return attr(tag, 'content');
  }
  return null;
}

function linkHref(html: string, rel: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const r = attr(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    if (r.includes(rel)) return attr(tag, 'href');
  }
  return null;
}

function headings(html: string, level: number): string[] {
  const re = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)</h${level}>`, 'gi');
  return [...html.matchAll(re)].map((m) => stripTags(m[1])).filter(Boolean);
}

function schemaTypes(html: string): string[] {
  const types = new Set<string>();
  const collect = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string') types.add(t);
      if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.add(x));
      Object.values(obj).forEach(collect);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collect(JSON.parse(m[1]));
    } catch {
      types.add('(invalid JSON-LD)');
    }
  }
  // Microdata
  for (const m of html.matchAll(/itemtype\s*=\s*["']https?:\/\/schema\.org\/(\w+)/gi)) types.add(m[1]);
  return [...types];
}

function parseRobots(text: string) {
  const sitemapRefs = [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  // Group directives by user-agent block.
  const groups: { agents: string[]; disallowRoot: boolean }[] = [];
  let current: { agents: string[]; disallowRoot: boolean } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallowRoot: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && key === 'disallow' && value === '/') current.disallowRoot = true;
    }
  }
  const blocked = (agent: string) => {
    const specific = groups.find((g) => g.agents.includes(agent.toLowerCase()));
    if (specific) return specific.disallowRoot;
    return groups.find((g) => g.agents.includes('*'))?.disallowRoot ?? false;
  };
  return {
    sitemapRefs,
    blockedAiBots: AI_BOTS.filter(blocked),
    disallowAll: groups.find((g) => g.agents.includes('*'))?.disallowRoot ?? false,
  };
}

function detectAnalytics(html: string): string[] {
  const found: string[] = [];
  const checks: [string, RegExp][] = [
    ['Google Analytics 4', /gtag\/js\?id=G-|googletagmanager\.com\/gtag/i],
    ['Google Tag Manager', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/],
    ['Meta Pixel', /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/],
    ['Microsoft Clarity', /clarity\.ms/],
    ['Hotjar', /static\.hotjar\.com/],
    ['GoHighLevel', /leadconnectorhq\.com|msgsndr\.com/],
    ['HubSpot', /js\.hs-scripts\.com|hs-analytics/],
    ['WordPress', /wp-content\//],
    ['Wix', /static\.wixstatic\.com|wix\.com/],
    ['Squarespace', /squarespace\.com|static1\.squarespace/],
    ['Shopify', /cdn\.shopify\.com/],
    ['Webflow', /webflow\.(com|io)/],
  ];
  for (const [name, re] of checks) if (re.test(html)) found.push(name);
  return found;
}

export async function crawlSite(rawUrl: string, onStep?: (label: string) => void): Promise<CrawlData> {
  const inputUrl = normalizeUrl(rawUrl);
  const origin = new URL(inputUrl).origin;
  const base: CrawlData = {
    inputUrl,
    finalUrl: inputUrl,
    ok: false,
    status: null,
    responseMs: null,
    htmlBytes: 0,
    https: inputUrl.startsWith('https://'),
    httpRedirectsToHttps: null,
    headers: {},
    title: null,
    metaDescription: null,
    metaRobots: null,
    canonical: null,
    lang: null,
    hasViewport: false,
    hasFavicon: false,
    openGraph: { title: false, description: false, image: false },
    twitterCard: false,
    h1: [],
    h2: [],
    h3Count: 0,
    schemaTypes: [],
    images: 0,
    imagesMissingAlt: 0,
    internalLinks: 0,
    externalLinks: 0,
    wordCount: 0,
    scripts: 0,
    stylesheets: 0,
    forms: 0,
    phoneLinks: 0,
    emailLinks: 0,
    hreflangCount: 0,
    analytics: [],
    robots: { found: false, status: null, bytes: 0, sitemapRefs: [], blockedAiBots: [], disallowAll: false },
    sitemap: { found: false, status: null, bytes: 0, urlCount: 0 },
    llmsTxt: { found: false, status: null, bytes: 0 },
  };

  onStep?.('Fetching homepage');
  let html = '';
  try {
    const start = Date.now();
    const res = await timedFetch(inputUrl);
    html = await res.text();
    base.responseMs = Date.now() - start;
    base.status = res.status;
    base.ok = res.ok;
    base.finalUrl = res.url || inputUrl;
    base.https = base.finalUrl.startsWith('https://');
    base.htmlBytes = html.length;
    for (const h of ['content-type', 'cache-control', 'content-encoding', 'server', 'strict-transport-security', 'x-robots-tag', 'x-powered-by']) {
      const v = res.headers.get(h);
      if (v) base.headers[h] = v;
    }
  } catch (e) {
    base.error = e instanceof Error ? e.message : String(e);
    return base;
  }

  const host = new URL(base.finalUrl).hostname.replace(/^www\./, '');
  base.title = (() => {
    const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return m ? stripTags(m[1]) : null;
  })();
  base.metaDescription = metaContent(html, 'description');
  base.metaRobots = metaContent(html, 'robots');
  base.canonical = linkHref(html, 'canonical');
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
  base.lang = htmlTag ? attr(htmlTag, 'lang') : null;
  base.hasViewport = !!metaContent(html, 'viewport');
  base.hasFavicon = !!(linkHref(html, 'icon') || linkHref(html, 'apple-touch-icon'));
  base.openGraph = {
    title: !!metaContent(html, 'og:title', 'property'),
    description: !!metaContent(html, 'og:description', 'property'),
    image: !!metaContent(html, 'og:image', 'property'),
  };
  base.twitterCard = !!metaContent(html, 'twitter:card');
  base.h1 = headings(html, 1);
  base.h2 = headings(html, 2).slice(0, 15);
  base.h3Count = headings(html, 3).length;
  base.schemaTypes = schemaTypes(html);

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  base.images = imgs.length;
  base.imagesMissingAlt = imgs.filter((t) => !(attr(t, 'alt') ?? '').trim()).length;

  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, 'href') ?? '';
    if (href.startsWith('tel:')) base.phoneLinks++;
    else if (href.startsWith('mailto:')) base.emailLinks++;
    else if (/^https?:\/\//i.test(href)) {
      try {
        const h = new URL(href).hostname.replace(/^www\./, '');
        if (h === host) base.internalLinks++;
        else base.externalLinks++;
      } catch {
        /* ignore malformed */
      }
    } else if (href && !href.startsWith('#') && !href.startsWith('javascript:')) base.internalLinks++;
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const text = stripTags(body.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' '));
  base.wordCount = text ? text.split(' ').filter((w) => /\w/.test(w)).length : 0;
  base.scripts = (html.match(/<script\b/gi) ?? []).length;
  base.stylesheets = (html.match(/<link\b[^>]*rel\s*=\s*["']?stylesheet/gi) ?? []).length;
  base.forms = (html.match(/<form\b/gi) ?? []).length;
  base.hreflangCount = (html.match(/hreflang\s*=/gi) ?? []).length;
  base.analytics = detectAnalytics(html);

  onStep?.('Checking robots.txt, sitemap & llms.txt');
  const siteOrigin = new URL(base.finalUrl).origin || origin;
  const [robots, llms, httpCheck] = await Promise.all([
    probe(`${siteOrigin}/robots.txt`),
    probe(`${siteOrigin}/llms.txt`),
    base.https
      ? timedFetch(siteOrigin.replace('https://', 'http://'))
          .then((r) => (r.url ? r.url.startsWith('https://') : null))
          .catch(() => null)
      : Promise.resolve(false),
  ]);
  base.httpRedirectsToHttps = httpCheck;
  base.llmsTxt = { found: llms.found, status: llms.status, bytes: llms.bytes };
  base.robots = { found: robots.found, status: robots.status, bytes: robots.bytes, ...parseRobots(robots.text) };

  const sitemapUrl = base.robots.sitemapRefs[0] ?? `${siteOrigin}/sitemap.xml`;
  let sitemap = await probe(sitemapUrl);
  if (!sitemap.found && !base.robots.sitemapRefs.length) sitemap = await probe(`${siteOrigin}/sitemap_index.xml`);
  base.sitemap = {
    found: sitemap.found,
    status: sitemap.status,
    bytes: sitemap.bytes,
    urlCount: (sitemap.text.match(/<loc>/gi) ?? []).length,
  };

  return base;
}
