/** Shared SEO-content model + validation (used by Worker APIs and tests). */

export interface ContentFaq {
  q: string;
  a: string;
}

export interface ToolPage {
  id: number;
  slug: string;
  badge: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  faqs: ContentFaq[];
  related_slugs: string[];
  status: string;
  /** DB row timestamp (always present on reads; absent on create/update inputs). */
  updated_at?: string;
}

export interface Guide {
  id: number;
  slug: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  faqs: ContentFaq[];
  related_slugs: string[];
  status: string;
  /** DB row timestamp (always present on reads; absent on create/update inputs). */
  updated_at?: string;
}

export type ToolPageInput = Omit<ToolPage, "id">;
export type GuideInput = Omit<Guide, "id">;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Arabic slugs: allow Arabic letters + digits + hyphens.
const SLUG_AR_RE = /^[a-z0-9\u0600-\u06FF]+(?:[-_][a-z0-9\u0600-\u06FF]+)*$/u;

export function isValidSlug(slug: unknown): boolean {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 120) return false;
  return SLUG_RE.test(slug) || SLUG_AR_RE.test(slug);
}

function isFaqList(v: unknown, min: number): v is ContentFaq[] {
  if (!Array.isArray(v) || v.length < min) return false;
  return v.every(
    (f) =>
      f &&
      typeof (f as ContentFaq).q === "string" &&
      (f as ContentFaq).q.trim().length >= 10 &&
      typeof (f as ContentFaq).a === "string" &&
      (f as ContentFaq).a.trim().length >= 30,
  );
}

function strList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 120);
}

/** No-thin-content rules: every public page needs substance + unique meta. */
export function validateToolPage(input: Record<string, unknown>): string | null {
  if (!isValidSlug(input["slug"])) return "Invalid slug (lowercase letters/digits/hyphens, max 120).";
  if (typeof input["badge"] !== "string" || input["badge"].length > 40) return "Badge max 40 chars.";
  if (input["lang"] !== "en" && input["lang"] !== "fr" && input["lang"] !== "ar") return "Lang must be en, fr or ar.";
  if (typeof input["target_keyword"] !== "string" || input["target_keyword"].trim().length < 3) return "Target keyword required.";
  if (typeof input["title"] !== "string" || input["title"].trim().length < 30 || input["title"].length > 160) return "Title must be 30-160 chars.";
  if (typeof input["description"] !== "string" || input["description"].trim().length < 120 || input["description"].length > 320) return "Meta description must be 120-320 chars.";
  if (typeof input["h1"] !== "string" || input["h1"].trim().length < 10 || input["h1"].length > 140) return "H1 must be 10-140 chars.";
  if (typeof input["intro"] !== "string" || input["intro"].trim().length < 100) return "Intro must be at least 100 chars (no thin pages).";
  if (!isFaqList(input["faqs"], 3)) return "At least 3 FAQs with answers ≥30 chars required.";
  if (input["related_slugs"] !== undefined && !strList(input["related_slugs"])) return "Invalid related slugs.";
  if (input["status"] !== "draft" && input["status"] !== "live") return "Status must be draft or live.";
  return null;
}

export function validateGuide(input: Record<string, unknown>): string | null {
  if (!isValidSlug(input["slug"])) return "Invalid slug (lowercase letters/digits/hyphens, max 120).";
  if (input["lang"] !== "en" && input["lang"] !== "fr" && input["lang"] !== "ar") return "Lang must be en, fr or ar.";
  if (typeof input["target_keyword"] !== "string" || input["target_keyword"].trim().length < 3) return "Target keyword required.";
  if (typeof input["title"] !== "string" || input["title"].trim().length < 30 || input["title"].length > 160) return "Title must be 30-160 chars.";
  if (typeof input["description"] !== "string" || input["description"].trim().length < 120 || input["description"].length > 320) return "Meta description must be 120-320 chars.";
  if (typeof input["h1"] !== "string" || input["h1"].trim().length < 10 || input["h1"].length > 140) return "H1 must be 10-140 chars.";
  if (typeof input["body"] !== "string" || input["body"].trim().length < 800) return "Body must be at least 800 chars (long-tail guide, no thin content).";
  if (!isFaqList(input["faqs"], 3)) return "At least 3 FAQs with answers ≥30 chars required.";
  if (input["related_slugs"] !== undefined && !strList(input["related_slugs"])) return "Invalid related slugs.";
  if (input["status"] !== "draft" && input["status"] !== "live") return "Status must be draft or live.";
  return null;
}

export function parseFaqs(raw: unknown): ContentFaq[] {
  if (typeof raw === "string") {
    try {
      const p: unknown = JSON.parse(raw);
      if (Array.isArray(p)) return p as ContentFaq[];
    } catch {
      return [];
    }
    return [];
  }
  return Array.isArray(raw) ? (raw as ContentFaq[]) : [];
}

export function parseSlugList(raw: unknown): string[] {
  if (typeof raw === "string") {
    try {
      const p: unknown = JSON.parse(raw);
      if (Array.isArray(p)) return (p as unknown[]).filter((s): s is string => typeof s === "string");
    } catch {
      return [];
    }
    return [];
  }
  return Array.isArray(raw) ? (raw as unknown[]).filter((s): s is string => typeof s === "string") : [];
}

/**
 * Minimal server-side HTML sanitizer for admin-authored guide bodies.
 * Admins are trusted, but defense in depth (plus CSP blocks inline scripts).
 * Allows: p,h2-h4,ul,ol,li,strong,em,a[href http(s)],img[src http(s),alt],blockquote,code,pre,br,hr,table bits.
 */
export function sanitizeGuideHtml(html: string): string {
  let out = String(html).slice(0, 60_000);
  out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<\/?(iframe|object|embed|form|input|button|style|link|meta|base)\b[^>]*>/gi, "");
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*"(javascript|data|vbscript)[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|src)\s*=\s*'(javascript|data|vbscript)[^']*'/gi, "$1='#'");
  // Drop all tags except the allowlist (keep inner text).
  const allowed = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "a", "img", "blockquote", "code", "pre", "br", "hr"]);
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, name: string) => {
    const n = name.toLowerCase();
    if (!allowed.has(n)) return "";
    if (n === "a") {
      const href = tag.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/href\s*=\s*'([^']*)'/i)?.[1] ?? "";
      const safe = /^https?:\/\//i.test(href) || href.startsWith("/") ? href.replace(/"/g, "") : "/";
      return `<a href="${safe}">`;
    }
    if (n === "img") {
      const src = tag.match(/src\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/src\s*=\s*'([^']*)'/i)?.[1] ?? "";
      if (!/^https?:\/\//i.test(src)) return "";
      const alt = tag.match(/alt\s*=\s*"([^"]*)"/i)?.[1] ?? "Guide image";
      return `<img src="${src.replace(/"/g, "")}" alt="${alt.replace(/"/g, "")}" loading="lazy" />`;
    }
    return n === "br" || n === "hr" ? `<${n} />` : tag.startsWith("</") ? `</${n}>` : `<${n}>`;
  });
  return out;
}

export interface LinkNode {
  kind: "tool" | "guide";
  slug: string;
  title: string;
  lang: string;
  target_keyword: string;
}

/**
 * Internal cross-linking graph: explicit related slugs first (live only),
 * then auto-fill with same-language siblings sharing keyword tokens.
 */
export function buildRelated(
  current: { slug: string; lang: string; target_keyword: string; related_slugs: string[] },
  pool: LinkNode[],
  max = 4,
): LinkNode[] {
  const live = new Map(pool.filter((p) => p.slug !== current.slug).map((p) => [p.slug, p]));
  const out: LinkNode[] = [];
  for (const s of current.related_slugs) {
    const n = live.get(s);
    if (n && out.length < max) {
      out.push(n);
      live.delete(s);
    }
  }
  if (out.length >= max) return out;
  const tokens = new Set(current.target_keyword.toLowerCase().split(/[\s\-_]+/).filter((t) => t.length > 2));
  const scored: { n: LinkNode; score: number }[] = [];
  for (const n of live.values()) {
    let score = 0;
    if (n.lang === current.lang) score += 2;
    for (const t of n.target_keyword.toLowerCase().split(/[\s\-_]+/)) {
      if (tokens.has(t)) score += 1;
    }
    if (score > 0) scored.push({ n, score });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const s of scored) {
    if (out.length >= max) break;
    out.push(s.n);
  }
  return out;
}
