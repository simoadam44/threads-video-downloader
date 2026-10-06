/**
 * Server-rendered SEO HTML for DB-driven tool pages and guides.
 * Strategy: reuse the built SPA shell (same CSS/JS, so React boots and the
 * downloader stays interactive) but replace head meta + pre-render content
 * into #root so crawlers get full HTML without JS. No React on the server.
 */
import type { ToolPage, Guide, LinkNode } from "./types";
import { trackingHeadHtml, trackingBodyHtml, robotsMetaContent, canonicalWithBase, type TrackingConfig } from "./tracking";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function faqJsonLd(faqs: { q: string; a: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });
}

function setMeta(html: string, attr: "name" | "property", key: string, value: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`);
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  lang: string;
  jsonLd: string[];
  tracking?: TrackingConfig;
  /** Extra trusted head HTML (e.g. AdSense auto-ads script). */
  extraHead?: string;
}

function applyTrackingHead(html: string, meta: PageMeta): string {
  const t = meta.tracking;
  if (!t) return html;
  const canonical = canonicalWithBase(meta.canonical, t);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  const robots = `<meta name="robots" content="${robotsMetaContent(t)}" />`;
  html = /<meta\s+name="robots"[^>]*>/i.test(html)
    ? html.replace(/<meta\s+name="robots"[^>]*>/i, robots)
    : html.replace("</head>", `${robots}\n</head>`);
  const head = trackingHeadHtml(t);
  if (head) html = html.replace("</head>", `${head}\n</head>`);
  if (meta.extraHead) html = html.replace("</head>", `${meta.extraHead}\n</head>`);
  return html;
}

function applyTrackingBody(html: string, meta: PageMeta): string {
  const body = meta.tracking ? trackingBodyHtml(meta.tracking) : "";
  return body ? html.replace("</body>", `${body}\n</body>`) : html;
}

/**
 * Standalone shell used when the SPA template is unavailable (e.g. local
 * runtimes without the Static Assets binding). Carries full SEO head +
 * content + cross-links; the interactive app shell is enhancement-only.
 */
export function renderMinimalShell(meta: PageMeta, contentHtml: string): string {
  const dir = meta.lang === "ar" ? "rtl" : "ltr";
  const ld = meta.jsonLd.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n");
  const out = `<!doctype html><html lang="${meta.lang}" dir="${dir}"><head><meta charset="UTF-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` +
    `<title>${escapeHtml(meta.title)}</title>` +
    `<meta name="description" content="${escapeHtml(meta.description)}" />` +
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />` +
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />` +
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />` +
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />` +
    `<meta property="og:type" content="article" />` +
    `<meta property="og:site_name" content="Threads Video Downloader" />` +
    `<meta property="og:locale" content="${meta.lang === "ar" ? "ar_AR" : "en_US"}" />` +
    `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />` +
    `<meta name="twitter:card" content="summary_large_image" />` +
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />` +
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />` +
    `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />` +
    `<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;line-height:1.6}</style>` +
    `${ld}</head><body>${contentHtml}</body></html>`;
  return applyTrackingBody(applyTrackingHead(out, meta), meta);
}

export function renderShell(template: string, meta: PageMeta, contentHtml: string): string {
  let html = template;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(meta.title)}</title>`);
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${meta.lang}" dir="${meta.lang === "ar" ? "rtl" : "ltr"}">`);
  html = html.replace(/(<div id="root">)(<\/div>)/, `$1${contentHtml}$2`);
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:title", meta.title);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:url", meta.canonical);
  html = setMeta(html, "property", "og:type", "article");
  html = setMeta(html, "property", "og:site_name", "Threads Video Downloader");
  html = setMeta(html, "property", "og:locale", meta.lang === "ar" ? "ar_AR" : "en_US");
  html = setMeta(html, "property", "og:image", meta.ogImage);
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:title", meta.title);
  html = setMeta(html, "name", "twitter:description", meta.description);
  html = setMeta(html, "name", "twitter:image", meta.ogImage);
  let link = html.match(/<link rel="canonical"[^>]*>/);
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`;
  html = link ? html.replace(link[0], canonicalTag) : html.replace("</head>", `${canonicalTag}\n</head>`);
  const ld = meta.jsonLd.map((j) => `\n<script type="application/ld+json">${j}</script>`).join("");
  html = html.replace("</head>", `${ld}\n</head>`);
  html = applyTrackingHead(html, meta);
  html = applyTrackingBody(html, meta);
  // No-index safety: dynamic pages are always indexable by design; admin stays separate.
  return html;
}

function relatedHtml(related: LinkNode[], base: string, label: string): string {
  if (related.length === 0) return "";
  const items = related
    .map((r) => `<li><a href="${base}/${escapeHtml(r.slug)}">${escapeHtml(r.title)}</a></li>`)
    .join("");
  return `<nav aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2><ul>${items}</ul></nav>`;
}

function faqHtml(faqs: { q: string; a: string }[]): string {
  if (faqs.length === 0) return "";
  return `<section><h2>Frequently Asked Questions</h2>${faqs
    .map((f) => `<div><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`)
    .join("")}</section>`;
}

/**
 * Server rendering for the built-in static SEO routes (replaces the removed
 * build-time prerender). Same template strategy: full app shell when
 * available, standalone crawlable shell otherwise, tracking always applied.
 */
export function renderStaticRoute(
  template: string | null,
  origin: string,
  ogImage: string,
  route: { path: string; title: string; description: string; h1: string },
  tracking?: TrackingConfig,
  adsHead?: string,
): string {
  const canonical = route.path === "/" ? `${origin}/` : `${origin}${route.path}`;
  const content = `<main><p>Fast and easy</p><h1>${escapeHtml(route.h1)}</h1><p>${escapeHtml(route.description)}</p>` +
    `<p><a href="/">Threads Video Downloader</a> · <a href="/how-to-download-threads-videos">How to download</a> · <a href="/faq">FAQ</a></p></main>`;
  const meta: PageMeta = {
    title: route.title,
    description: route.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: "en",
    tracking,
    extraHead: adsHead,
    jsonLd: [
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Threads Video Downloader",
        url: origin,
      }),
    ],
  };
  return template ? renderShell(template, meta, content) : renderMinimalShell(meta, content);
}

export function renderToolPage(
  template: string | null,
  origin: string,
  ogImage: string,
  page: ToolPage,
  related: LinkNode[],
  tracking?: TrackingConfig,
  adsHead?: string,
): string {
  const canonical = `${origin}/${page.slug}`;
  const content = `<main><p>${escapeHtml(page.badge)}</p><h1>${escapeHtml(page.h1)}</h1>` +
    `<p>${escapeHtml(page.intro)}</p><div id="tool-mount"></div>` +
    faqHtml(page.faqs) +
    relatedHtml(related, origin, "Related tools") +
    `<p><a href="/">Threads Video Downloader</a> · <a href="/how-to-download-threads-videos">How to download</a> · <a href="/faq">FAQ</a></p></main>`;
  const meta: PageMeta = {
    title: page.title,
    description: page.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: page.lang,
    tracking,
    extraHead: adsHead,
    jsonLd: [
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: page.title,
        url: canonical,
        applicationCategory: "Multimedia",
        operatingSystem: "Any",
      }),
      faqJsonLd(page.faqs),
    ],
  };
  return template ? renderShell(template, meta, content) : renderMinimalShell(meta, content);
}

export function renderGuide(
  template: string | null,
  origin: string,
  ogImage: string,
  guide: Guide,
  related: LinkNode[],
  tracking?: TrackingConfig,
  adsHead?: string,
): string {
  const canonical = `${origin}/blog/${guide.slug}`;
  const content = `<main><article><h1>${escapeHtml(guide.h1)}</h1>${guide.body}` +
    faqHtml(guide.faqs) +
    relatedHtml(related, `${origin}/blog`, "Related guides") +
    `<p><a href="/">Threads Video Downloader</a> · <a href="/blog">All guides</a></p></article></main>`;
  const meta: PageMeta = {
    title: guide.title,
    description: guide.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: guide.lang,
    tracking,
    extraHead: adsHead,
    jsonLd: [
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: canonical,
      }),
      faqJsonLd(guide.faqs),
    ],
  };
  return template ? renderShell(template, meta, content) : renderMinimalShell(meta, content);
}
