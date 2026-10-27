// Canonical production origin. `https://www.<domain>` is canonical: the apex
// host 301-redirects to it in the Worker (see canonicalHostRedirect), so
// canonicals, OG URLs, sitemap and robots must all use this same host.
export const SITE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SITE_URL) ||
  "https://www.savethreadsvideos.com";

export function canonicalFor(path: string): string {
  const p = path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return SITE_URL.replace(/\/$/, "") + p;
}

export interface PageSeo {
  title: string;
  description: string;
  /** Route path (no origin), e.g. "/blog/my-guide". */
  canonicalPath: string;
  ogType?: "website" | "article";
  /** Optional robots directive, e.g. "noindex, nofollow" for client-side misses. */
  robots?: string;
}

function upsertMeta(attr: "name" | "property", key: string, value: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/**
 * Keep client-side metadata in sync with the server-rendered head.
 * Dynamic pages previously left the homepage/blog hub canonical + description
 * in place after hydration, which made Google consolidate them elsewhere.
 */
export function applyPageSeo(seo: PageSeo): void {
  if (typeof document === "undefined") return;
  const canonical = canonicalFor(seo.canonicalPath);
  document.title = seo.title;
  upsertMeta("name", "description", seo.description);
  upsertMeta("property", "og:title", seo.title);
  upsertMeta("property", "og:description", seo.description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:type", seo.ogType ?? "website");
  upsertMeta("name", "twitter:title", seo.title);
  upsertMeta("name", "twitter:description", seo.description);
  if (seo.robots) upsertMeta("name", "robots", seo.robots);
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = canonical;
}
