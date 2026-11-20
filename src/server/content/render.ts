/**
 * Server-rendered SEO HTML for DB-driven tool pages and guides.
 * Strategy: reuse the built SPA shell (same CSS/JS, so React boots and the
 * downloader stays interactive) but replace head meta + pre-render content
 * into #root so crawlers get full HTML without JS. No React on the server.
 */
import type { ToolPage, Guide, LinkNode } from "./types";
import { trackingHeadHtml, trackingBodyHtml, robotsMetaContent, canonicalWithBase, type TrackingConfig } from "./tracking";
import { FAQ_ITEMS } from "../../lib/faq";
import { infoPageFor, type InfoBlock } from "../../lib/info-pages";
import { toolContentFor, type ToolFaq, type ToolSection } from "../../lib/tool-content";
import { siblingsFor } from "../../lib/seo-routes";
import { HOME_FAQS, HOME_LINKS, HOME_SECTIONS, type HomeLink } from "../../lib/home-content";
import { BLOG_INTRO, BLOG_LINKS, BLOG_SECTIONS } from "../../lib/blog-content";
import { hreflangFor, localizedHomeFor } from "../../lib/localized-home";
import { isRemovedToolSlug, isRetiredGuideSlug } from "./redirects";
import { repairContentLinks } from "./links";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Schema.org locale for the languages the site actually supports. */
function ogLocale(lang: string): string {
  if (lang === "ar") return "ar_AR";
  if (lang === "fr") return "fr_FR";
  return "en_US";
}

function ogImageTags(image: string): string {
  return (
    `<meta property="og:image" content="${escapeHtml(image)}" />` +
    `<meta property="og:image:width" content="1200" />` +
    `<meta property="og:image:height" content="630" />` +
    `<meta property="og:image:alt" content="Threads Video Downloader" />`
  );
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
  /** Open Graph object type. Static/tool pages are "website"; guides are "article". */
  ogType?: "website" | "article";
  jsonLd: string[];
  /** Absolute hreflang alternates (already origin-prefixed). */
  hreflang?: { hreflang: string; href: string }[];
  tracking?: TrackingConfig;
  /** Extra trusted head HTML (e.g. AdSense auto-ads script). */
  extraHead?: string;
}

function hreflangHtml(meta: PageMeta): string {
  if (!meta.hreflang?.length) return "";
  return (
    meta.hreflang
      .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
      .join("\n") + "\n"
  );
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
    `<meta property="og:type" content="${meta.ogType ?? "website"}" />` +
    `<meta property="og:site_name" content="Threads Video Downloader" />` +
    `<meta property="og:locale" content="${ogLocale(meta.lang)}" />` +
    ogImageTags(meta.ogImage) +
    `<meta name="twitter:card" content="summary_large_image" />` +
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />` +
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />` +
    `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />` +
    hreflangHtml(meta) +
    `<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;line-height:1.6}</style>` +
    `${ld}</head><body>${contentHtml}</body></html>`;
  return applyTrackingBody(applyTrackingHead(out, meta), meta);
}

/**
 * Replace the contents of the SPA mount point with server-rendered HTML.
 * The built index.html ships a no-JS fallback inside #root, so a naive
 * empty-div replacement silently fails and leaves homepage content on every
 * route. This walks div nesting to find the real closing tag.
 */
export function injectRoot(html: string, contentHtml: string): string {
  const open = /<div\b[^>]*\bid="root"[^>]*>/i.exec(html);
  if (!open) return html;
  const start = open.index + open[0].length;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + contentHtml + html.slice(m.index);
  }
  return html;
}

/** Crawlable site navigation (plain anchors, existing routes only). */
export function siteHeaderHtml(): string {
  return (
    `<header class="site"><div class="container nav">` +
    `<a class="brand" href="/">Threads Video Downloader</a>` +
    `<nav class="nav-links" aria-label="Main">` +
    `<a href="/">Home</a>` +
    `<a href="/threads-video-downloader">Video Downloader</a>` +
    `<a href="/threads-photo-downloader">Photo Downloader</a>` +
    `<a href="/threads-carousel-downloader">Carousel Downloader</a>` +
    `<a href="/how-to-use">How to Use</a>` +
    `<a href="/faq">FAQ</a>` +
    `<a href="/blog">Blog</a>` +
    `</nav></div></header>`
  );
}

export function siteFooterHtml(): string {
  return (
    `<footer class="site"><div class="container">` +
    `<nav aria-label="Footer">` +
    `<a href="/threads-video-downloader">Video Downloader</a> · ` +
    `<a href="/threads-photo-downloader">Photo Downloader</a> · ` +
    `<a href="/threads-carousel-downloader">Carousel Downloader</a> · ` +
    `<a href="/how-to-use">How to Use</a> · ` +
    `<a href="/faq">FAQ</a> · ` +
    `<a href="/blog">Blog</a> · ` +
    `<a href="/about">About</a> · ` +
    `<a href="/privacy">Privacy</a> · ` +
    `<a href="/terms">Terms</a> · ` +
    `<a href="/disclaimer">Disclaimer</a> · ` +
    `<a href="/contact">Contact</a>` +
    `</nav>` +
    `<small>This website is an independent third-party tool and is not affiliated with or endorsed by Threads or Meta.</small>` +
    `</div></footer>`
  );
}

/** Render one shared content block (see src/lib/info-pages.ts). */
function infoBlocksHtml(blocks: InfoBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "h2":
          return `<h2>${escapeHtml(b.text)}</h2>`;
        case "h3":
          return `<h3>${escapeHtml(b.text)}</h3>`;
        case "p":
          return `<p>${escapeHtml(b.text)}</p>`;
        case "note":
          return `<p class="note">${escapeHtml(b.text)}</p>`;
        case "ul":
          return `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
        case "ol":
          return `<ol>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
        default:
          return "";
      }
    })
    .join("");
}


export function renderShell(template: string, meta: PageMeta, contentHtml: string): string {
  let html = template;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(meta.title)}</title>`);
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${meta.lang}" dir="${meta.lang === "ar" ? "rtl" : "ltr"}">`);
  html = injectRoot(html, contentHtml);
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:title", meta.title);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:url", meta.canonical);
  html = setMeta(html, "property", "og:type", meta.ogType ?? "website");
  html = setMeta(html, "property", "og:site_name", "Threads Video Downloader");
  html = setMeta(html, "property", "og:locale", ogLocale(meta.lang));
  html = setMeta(html, "property", "og:image", meta.ogImage);
  html = setMeta(html, "property", "og:image:width", "1200");
  html = setMeta(html, "property", "og:image:height", "630");
  html = setMeta(html, "property", "og:image:alt", "Threads Video Downloader");
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:title", meta.title);
  html = setMeta(html, "name", "twitter:description", meta.description);
  html = setMeta(html, "name", "twitter:image", meta.ogImage);
  let link = html.match(/<link rel="canonical"[^>]*>/);
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`;
  html = link ? html.replace(link[0], canonicalTag) : html.replace("</head>", `${canonicalTag}\n</head>`);
  const alternates = hreflangHtml(meta);
  if (alternates) html = html.replace("</head>", `${alternates}</head>`);
  const ld = meta.jsonLd.map((j) => `\n<script type="application/ld+json">${j}</script>`).join("");
  html = html.replace("</head>", `${ld}\n</head>`);
  html = applyTrackingHead(html, meta);
  html = applyTrackingBody(html, meta);
  // No-index safety: dynamic pages are always indexable by design; admin stays separate.
  return html;
}

/** Canonical path for a cross-link: guides live under /blog, tools at the root. */
function linkPath(node: LinkNode): string {
  return node.kind === "guide" ? `/blog/${node.slug}` : `/${node.slug}`;
}

/** Retired/gone pages never receive an internal link (they answer 301/410). */
function isLinkable(node: LinkNode): boolean {
  return node.kind === "guide" ? !isRetiredGuideSlug(node.slug) : !isRemovedToolSlug(node.slug);
}

/**
 * Related-pages nav. `kind` decides the prefix (guides are `/blog/<slug>`,
 * tools are `/<slug>`); before this the caller's base was applied to both and
 * produced `/blog/<tool-slug>` and `/<guide-slug>` 404s.
 */
function relatedHtml(related: LinkNode[], origin: string, label: string): string {
  const items = related
    .filter(isLinkable)
    .map((r) => `<li><a href="${escapeHtml(origin + linkPath(r))}">${escapeHtml(r.title)}</a></li>`)
    .join("");
  if (items === "") return "";
  return `<nav aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2><ul>${items}</ul></nav>`;
}

function faqHtml(faqs: ToolFaq[]): string {
  if (faqs.length === 0) return "";
  return `<section><h2>Frequently Asked Questions</h2>${faqs
    .map((f) => `<div><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`)
    .join("")}</section>`;
}

/** Long-form sections shared by the homepage and the three tool pages. */
function sectionsHtml(sections: ToolSection[]): string {
  return sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.h2)}</h2>` +
        s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
        (s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : "") +
        `</section>`,
    )
    .join("");
}

/**
 * Contextual internal links from the homepage. Anchor text is the destination
 * page's own H1, not a keyword list: with 97% of the site's visibility sitting
 * on `/`, the rest of the site has to be reachable from body copy.
 */
function homeLinksHtml(links: HomeLink[]): string {
  if (links.length === 0) return "";
  return `<nav aria-label="Explore the downloader"><h2>Where to go next</h2>${links
    .map(
      (l) =>
        `<div><h3><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></h3>` +
        `<p>${escapeHtml(l.summary)}</p></div>`,
    )
    .join("")}</nav>`;
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
  route: { path: string; title: string; description: string; h1: string; summary?: string },
  tracking?: TrackingConfig,
  adsHead?: string,
  guides?: { slug: string; title: string }[],
): string {
  const canonical = route.path === "/" ? `${origin}/` : `${origin}${route.path}`;
  const info = infoPageFor(route.path);
  const localized = localizedHomeFor(route.path);
  const tool = toolContentFor(route.path);
  let main: string;
  if (info) {
    // Legal / informational pages: the same blocks rendered by React, so the
    // crawlable HTML and the visible page cannot drift. Before this, the
    // server output was a single sentence — thin content for search engines.
    const updated = info.updated ? `<p><small>Last updated: ${escapeHtml(info.updated)}</small></p>` : "";
    const related = info.related?.length
      ? `<nav aria-label="Related pages"><h2>Related pages</h2><ul>${info.related
          .map((r) => `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a></li>`)
          .join("")}</ul></nav>`
      : "";
    main =
      `<main><h1>${escapeHtml(route.h1)}</h1>` +
      `<p>${escapeHtml(info.intro)}</p>${updated}` +
      infoBlocksHtml(info.blocks) +
      related +
      `</main>`;
  } else if (localized) {
    // Real localized entry point (/ar, /fr). Copy lives in
    // src/lib/localized-home.ts and is shared with the React page, so the
    // crawlable HTML and the hydrated page carry identical text. The canonical
    // stays self-referential and the hreflang cluster in <head> ties the three
    // language versions together instead of treating them as duplicates.
    main =
      `<main lang="${localized.lang}" dir="${localized.dir}">` +
      `<h1>${escapeHtml(localized.h1)}</h1>` +
      `<p>${escapeHtml(localized.intro)}</p>` +
      sectionsHtml(localized.sections) +
      `<section><h2>${escapeHtml(localized.faqTitle)}</h2>${localized.faqs
        .map((f) => `<div><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`)
        .join("")}</section>` +
      `<p><a href="/" hreflang="en" lang="en">${escapeHtml(localized.englishLabel)}</a></p>` +
      `</main>`;
  } else {
    main = `<main><h1>${escapeHtml(route.h1)}</h1><p>${escapeHtml(route.description)}</p>` +
      (route.summary ? `<p>${escapeHtml(route.summary)}</p>` : "");
    // The homepage is the page that ranks for the product keywords, so it
    // carries the same long-form treatment as the tool pages instead of a
    // single sentence. Copy lives in src/lib/home-content.ts and is shared
    // with the React page.
    if (route.path === "/") {
      main += sectionsHtml(HOME_SECTIONS);
      main += faqHtml(HOME_FAQS);
      main += homeLinksHtml(HOME_LINKS);
    }
    // The three primary tool pages carry long-form copy from the shared
    // module so the pre-rendered HTML is not a single paragraph.
    if (tool) {
      main += sectionsHtml(tool.sections);
      main += faqHtml(tool.faqs);
      main += `<nav aria-label="Related pages"><h2>Related pages</h2><ul>${siblingsFor(route.path)
        .map((l) => `<li><a href="${escapeHtml(l.path)}">${escapeHtml(l.label)}</a></li>`)
        .join("")}</ul></nav>`;
    }
    if (route.path !== "/") {
      main += `<p><a href="/">Threads Video Downloader</a> · <a href="/how-to-use">How to use</a> · <a href="/faq">FAQ</a></p>`;
    }
    // /faq: put the real answers in the initial HTML (not only after hydration).
    if (route.path === "/faq") {
      main += `<section><h2>Common questions</h2>${FAQ_ITEMS.map(
        (f) => `<div><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`,
      ).join("")}</section>`;
    }
    // The /blog hub used to be a bare list of link titles (~20 words of body
    // text once navigation is discounted). It now carries the same long-form
    // copy as the React page, from the shared module.
    if (route.path === "/blog") {
      main += `<p>${escapeHtml(BLOG_INTRO)}</p>` + sectionsHtml(BLOG_SECTIONS);
    }
    // The /blog hub lists live guides so crawlers discover every article.
    if (route.path === "/blog" && guides && guides.length > 0) {
      main += `<nav aria-label="Latest guides"><h2>Latest guides</h2><ul>` +
        guides
          .slice(0, 100)
          .map((g) => `<li><a href="/blog/${escapeHtml(g.slug)}">${escapeHtml(g.title)}</a></li>`)
          .join("") +
        `</ul></nav>`;
    }
    if (route.path === "/blog") main += homeLinksHtml(BLOG_LINKS);
    main += `</main>`;
  }
  const content = `${siteHeaderHtml()}${main}${siteFooterHtml()}`;
  const schemas = [
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Threads Video Downloader",
      url: origin,
    }),
  ];
  // The homepage is the product page: describe the application itself and the
  // questions a visitor can actually read on it (no ratings, no user counts).
  if (route.path === "/") {
    schemas.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Threads Video Downloader",
        url: canonical,
        description: route.description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        inLanguage: "en",
      }),
    );
    schemas.push(faqJsonLd(HOME_FAQS));
  }
  if (route.path === "/faq") schemas.push(faqJsonLd(FAQ_ITEMS));
  // Localized homepages describe the same application in their own language.
  if (localized) {
    schemas.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: localized.h1,
        url: canonical,
        description: localized.description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        inLanguage: localized.lang,
      }),
    );
    schemas.push(faqJsonLd(localized.faqs));
  }
  if (tool) {
    // Visible Q/A on the page, so the matching structured data is legitimate.
    schemas.push(faqJsonLd(tool.faqs));
    schemas.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: route.h1, item: canonical },
        ],
      }),
    );
  }
  // Breadcrumbs only where the trail is factually a trail (Home → page).
  if (info) {
    schemas.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: route.h1, item: canonical },
        ],
      }),
    );
  }
  const alternates = hreflangFor(route.path)?.map((a) => ({
    hreflang: a.hreflang,
    href: a.href === "/" ? `${origin}/` : `${origin}${a.href}`,
  }));
  const meta: PageMeta = {
    title: route.title,
    description: route.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: localized?.lang ?? "en",
    ogType: "website",
    hreflang: alternates,
    tracking,
    extraHead: adsHead,
    jsonLd: schemas,
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
  const content = `${siteHeaderHtml()}<main><p>${escapeHtml(page.badge)}</p><h1>${escapeHtml(page.h1)}</h1>` +
    `<p>${escapeHtml(page.intro)}</p><div id="tool-mount"></div>` +
    faqHtml(page.faqs) +
    relatedHtml(related, origin, "Related tools") +
    `<p><a href="/">Threads Video Downloader</a> · <a href="/how-to-download-threads-videos">How to download</a> · <a href="/faq">FAQ</a></p></main>${siteFooterHtml()}`;
  const meta: PageMeta = {
    title: page.title,
    description: page.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: page.lang,
    ogType: "website",
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
  // Stored bodies can contain retired links and anchors whose closer was saved
  // as `<a href="/">`; repair them at render time (rows are never mutated).
  const body = repairContentLinks(guide.body, origin);
  const content = `${siteHeaderHtml()}<main><article><h1>${escapeHtml(guide.h1)}</h1>${body}` +
    faqHtml(guide.faqs) +
    relatedHtml(related, origin, "Related guides") +
    `<p><a href="/">Threads Video Downloader</a> · <a href="/blog">All guides</a></p></article></main>${siteFooterHtml()}`;
  const meta: PageMeta = {
    title: guide.title,
    description: guide.description,
    canonical,
    ogImage: `${origin}${ogImage}`,
    lang: guide.lang,
    ogType: "article",
    tracking,
    extraHead: adsHead,
    jsonLd: [
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        image: `${origin}${ogImage}`,
        inLanguage: guide.lang,
        mainEntityOfPage: canonical,
      }),
      faqJsonLd(guide.faqs),
    ],
  };
  return template ? renderShell(template, meta, content) : renderMinimalShell(meta, content);
}
