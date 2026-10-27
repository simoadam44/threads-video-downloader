import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sitemapXml, canonicalPath, encodePath, canonicalHostRedirect } from "../src/server/worker";
import { THEME_SCRIPT_HASH, cspHeaderValue } from "../src/lib/csp";
import { renderStaticRoute, renderMinimalShell, injectRoot } from "../src/server/content/render";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { FAQ_ITEMS } from "../src/lib/faq";

// `https://www.<domain>` is canonical; the apex host 301-redirects to it.
const ORIGIN = "https://www.savethreadsvideos.com";
const route = { path: "/faq", title: "FAQ - Threads Video Downloader", description: "Answers here.", h1: "FAQ" };

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

describe("sitemap XML validity", () => {
  const xml = sitemapXml(ORIGIN, [
    { kind: "tool", slug: "threads-video-downloader-hd", updated_at: "2026-10-06T00:00:00Z" },
    { kind: "guide", slug: "some-guide", updated_at: "" },
  ]);
  it("is well-formed XML with correct content", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect((xml.match(/<url>/g) || []).length).toBe((xml.match(/<\/url>/g) || []).length);
  });
  it("contains only canonical https URLs, no dupes, no junk", () => {
    const urls = locs(xml);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u.startsWith(ORIGIN)).toBe(true);
      // Never the apex (redirecting) host.
      expect(u).not.toContain("//savethreadsvideos.com");
      expect(u).not.toContain("localhost");
      expect(u).not.toContain("example.com");
      expect(u).not.toContain("/api/");
      expect(u).not.toContain("/admin");
    }
    expect(urls).toContain(`${ORIGIN}/threads-video-downloader-hd`);
    expect(urls).toContain(`${ORIGIN}/blog/some-guide`);
  });
  it("percent-encodes non-ASCII slugs (Arabic) for unambiguous <loc> values", () => {
    const arabic = "تحميل-فيديو-ثريدز";
    const arabicXml = sitemapXml(ORIGIN, [{ kind: "tool", slug: arabic, updated_at: "" }]);
    const loc = locs(arabicXml).find((u) => u.includes("%")) ?? "";
    expect(loc).toBe(`${ORIGIN}/${encodeURIComponent(arabic)}`);
    expect(decodeURIComponent(loc)).toBe(`${ORIGIN}/${arabic}`);
    // Never emits raw non-ASCII bytes inside <loc>.
    for (const u of locs(arabicXml)) expect(/^[\x20-\x7E]+$/.test(u)).toBe(true);
  });
  it("emits lastmod only when meaningful", () => {
    expect(xml).toContain("<lastmod>2026-10-06</lastmod>");
  });
  it("covers every path in the SEO_ROUTES registry (no drift for static fallback)", () => {
    // scripts/gen-static-seo.mjs and the worker's seoRoutes() both derive from
    // SEO_ROUTES — this test fails if a registry route is missing from the sitemap.
    const staticXml = sitemapXml(ORIGIN, []);
    const urls = locs(staticXml);
    for (const r of SEO_ROUTES) {
      expect(urls).toContain(`${ORIGIN}${r.path}`);
    }
  });
});

describe("canonical paths", () => {
  it("strips trailing slashes except root", () => {
    expect(canonicalPath("/faq/")).toBe("/faq");
    expect(canonicalPath("/faq///")).toBe("/faq");
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/blog/x")).toBe("/blog/x");
  });
  it("encodePath leaves ASCII slugs untouched and encodes non-ASCII segments", () => {
    expect(encodePath("/threads-video-downloader-hd")).toBe("/threads-video-downloader-hd");
    expect(encodePath("/blog/some-guide")).toBe("/blog/some-guide");
    expect(encodePath("/")).toBe("/");
    expect(encodePath("/تحميل-فيديو-ثريدز")).toBe(`/${encodeURIComponent("تحميل-فيديو-ثريدز")}`);
  });
});

describe("rendered SEO pages", () => {
  const html = renderStaticRoute(null, ORIGIN, "/og-image.png", route);
  it("has title, description, canonical, one H1, OG/Twitter, valid JSON-LD", () => {
    expect(html).toContain("<title>FAQ - Threads Video Downloader</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain(`rel="canonical" href="${ORIGIN}/faq"`);
    expect((html.match(/<h1>/g) || []).length).toBe(1);
    for (const tag of ["og:title", "og:description", "og:url", "og:type", "og:image", "og:site_name", "og:locale", "twitter:card", "twitter:title", "twitter:image"]) {
      expect(html).toContain(tag);
    }
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      const parsed = JSON.parse(b[1]) as { "@context"?: string };
      expect(parsed["@context"]).toBe("https://schema.org");
    }
  });
  it("uses a PNG social image with explicit dimensions (SVG is not supported by most platforms)", () => {
    expect(html).toContain(`og:image" content="${ORIGIN}/og-image.png"`);
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
    expect(html).not.toContain("og-image.svg");
  });
  it("has no noindex on public pages and no placeholder domains", () => {
    expect(html).not.toContain("noindex");
    expect(html).not.toContain("example.com");
    expect(html).not.toContain("localhost");
  });
  it("server-renders the FAQ answers + FAQPage schema on /faq (no JS required)", () => {
    // Every answer must be in the initial HTML, not only after hydration.
    for (const f of FAQ_ITEMS) expect(html).toContain(f.q);
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"WebSite"');
  });
  it("includes crawlable header/footer navigation links", () => {
    for (const href of ["/threads-video-downloader", "/threads-photo-downloader", "/threads-carousel-downloader", "/faq", "/blog", "/privacy", "/terms", "/contact"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
  it("minimal shell is crawlable without JS", () => {
    const m = renderMinimalShell(
      { title: "T", description: "D", canonical: `${ORIGIN}/x`, ogImage: `${ORIGIN}/og-image.png`, lang: "en", jsonLd: [] },
      "<main><h1>H</h1></main>",
    );
    expect(m).toContain("<h1>H</h1>");
    expect(m).toContain("og:site_name");
  });
  it("minimal shell keeps correct direction for RTL content", () => {
    const m = renderMinimalShell(
      { title: "T", description: "D", canonical: `${ORIGIN}/x`, ogImage: `${ORIGIN}/og-image.png`, lang: "ar", jsonLd: [] },
      "<main><h1>H</h1></main>",
    );
    expect(m).toContain('lang="ar" dir="rtl"');
    expect(m).toContain('og:locale" content="ar_AR"');
  });
});

describe("SPA shell root injection", () => {
  // The built index.html ships a no-JS fallback *inside* #root; a naive
  // empty-div replace silently fails and leaves homepage content on every route.
  const template =
    '<!doctype html><html lang="en" dir="ltr"><head><title>Home</title></head><body>' +
    '<div id="root"><main><h1>Home fallback</h1><div class="x">inner</div></main></div>' +
    '<script type="module" src="/assets/app.js"></script></body></html>';

  it("replaces the whole #root subtree, keeping the scripts", () => {
    const out = injectRoot(template, "<main><h1>Route page</h1></main>");
    expect(out).toContain("<main><h1>Route page</h1></main>");
    expect(out).not.toContain("Home fallback");
    expect(out).not.toContain('class="x"');
    expect(out).toContain("/assets/app.js");
    expect(out.match(/id="root"/g)?.length).toBe(1);
  });

  it("leaves the HTML untouched when there is no #root", () => {
    const plain = "<html><body><p>hi</p></body></html>";
    expect(injectRoot(plain, "<main>x</main>")).toBe(plain);
  });
});

describe("CSP vs the inline theme script", () => {
  // `script-src 'self'` blocks inline scripts. Without the hash the anti-FOUC
  // theme bootstrap never runs (wrong-theme flash, stored preference ignored).
  // This test fails if index.html's inline script changes and the hash is stale.
  it("hash in the CSP matches the inline script in index.html", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const hash = createHash("sha256").update(m?.[1] ?? "", "utf8").digest("base64");
    expect(THEME_SCRIPT_HASH).toBe(`'sha256-${hash}'`);
  });

  // Vite injects its own inline preamble/HMR scripts in dev; sending the strict
  // production policy there crashes hydration ("can't detect preamble") and the
  // page renders as unstyled SSR text. Regression guard for that.
  it("is omitted in dev and strict in production", () => {
    expect(cspHeaderValue({ isDev: true })).toBeNull();

    const prod = cspHeaderValue({ isDev: false });
    expect(prod).toContain("default-src 'self'");
    expect(prod).toContain(THEME_SCRIPT_HASH);
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("frame-ancestors 'none'");
  });

  it("adds vendor hosts only when configured", () => {
    const widened = cspHeaderValue({
      isDev: false,
      scriptSrc: ["https://www.googletagmanager.com"],
      connectSrc: ["https://www.google-analytics.com"],
      imgSrc: ["https://www.googletagmanager.com"],
    });
    expect(widened).toContain("https://www.googletagmanager.com");
    expect(widened).toContain("https://www.google-analytics.com");
    expect(widened).toContain("img-src 'self' https: data: https://www.googletagmanager.com");
  });

  it("allows the Cloudflare Web Analytics beacon the zone injects", () => {
    const prod = cspHeaderValue({ isDev: false }) ?? "";
    expect(prod).toContain("script-src");
    expect(prod).toContain("https://static.cloudflareinsights.com");
    expect(prod).toContain("connect-src 'self' https://cloudflareinsights.com");
  });

  // Browsers ignore 'unsafe-inline' when a hash is present. Emitting both
  // silently blocked the GA4 inline bootstrap and any admin custom head code.
  it("drops the hash when inline scripts are explicitly allowed", () => {
    const widened = cspHeaderValue({ isDev: false, scriptSrc: ["'unsafe-inline'"] }) ?? "";
    expect(widened).toContain("'unsafe-inline'");
    expect(widened).not.toContain(THEME_SCRIPT_HASH);
  });
});

describe("SEO registry quality", () => {  it("unique titles/descriptions/H1s across routes", () => {
    const titles = SEO_ROUTES.map((r) => r.title);
    const descs = SEO_ROUTES.map((r) => r.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
    for (const r of SEO_ROUTES) {
      expect(r.title.length).toBeGreaterThan(20);
      expect(r.description.length).toBeGreaterThan(60);
      expect(r.h1.length).toBeGreaterThan(3);
    }
  });
});

describe("canonical host redirect (apex -> https://www)", () => {
  const CANON = "https://www.savethreadsvideos.com";

  function redirect(from: string, method = "GET") {
    const res = canonicalHostRedirect(new Request(from, { method }), CANON);
    return res ? { status: res.status, location: res.headers.get("location") } : null;
  }

  it("301s the apex host to the www host in a single hop", () => {
    expect(redirect("https://savethreadsvideos.com/")).toEqual({
      status: 301,
      location: "https://www.savethreadsvideos.com/",
    });
  });

  it("upgrades plain HTTP on both hosts (including http://www)", () => {
    expect(redirect("http://savethreadsvideos.com/")?.location).toBe("https://www.savethreadsvideos.com/");
    expect(redirect("http://www.savethreadsvideos.com/")?.location).toBe("https://www.savethreadsvideos.com/");
  });

  it("preserves nested paths, trailing slashes and query strings exactly", () => {
    expect(redirect("https://savethreadsvideos.com/blog/example/")?.location).toBe(
      "https://www.savethreadsvideos.com/blog/example/",
    );
    expect(redirect("https://savethreadsvideos.com/?utm_source=test&a=1")?.location).toBe(
      "https://www.savethreadsvideos.com/?utm_source=test&a=1",
    );
    expect(redirect("https://savethreadsvideos.com/sitemap.xml")?.location).toBe(
      "https://www.savethreadsvideos.com/sitemap.xml",
    );
  });

  it("never redirects the canonical host (no loop)", () => {
    expect(redirect("https://www.savethreadsvideos.com/")).toBeNull();
    expect(redirect("https://www.savethreadsvideos.com/faq?x=1")).toBeNull();
  });

  it("leaves unrelated hosts and local development untouched", () => {
    expect(redirect("https://threads-video-downloader.hamdi708090.workers.dev/")).toBeNull();
    expect(redirect("http://127.0.0.1:8788/")).toBeNull();
    expect(redirect("http://localhost:5173/faq")).toBeNull();
    // A lookalike domain must not match the apex rule.
    expect(redirect("https://savethreadsvideos.com.evil.example/")).toBeNull();
    expect(redirect("https://www.savethreadsvideos.com.evil.example/")).toBeNull();
  });

  it("does not rewrite non-idempotent methods (a 301 would turn POST into GET)", () => {
    expect(redirect("https://savethreadsvideos.com/api/resolve", "POST")).toBeNull();
    expect(redirect("https://savethreadsvideos.com/api/resolve", "GET")?.status).toBe(301);
  });

  it("is a 301 with cacheable headers", () => {
    const res = canonicalHostRedirect(new Request("https://savethreadsvideos.com/x"), CANON);
    expect(res?.status).toBe(301);
    expect(res?.headers.get("cache-control")).toContain("max-age=");
    expect(res?.body).toBeNull();
  });
});
describe("canonical host redirect fail-safes", () => {
  it("does not redirect when the canonical base is not a distinct www host", () => {
    // SITE_URL unset ? siteUrl() falls back to the request origin. Redirecting
    // there would point the request at itself (infinite loop).
    const req = new Request("https://test.local/faq");
    expect(canonicalHostRedirect(req, "https://test.local")).toBeNull();
    expect(canonicalHostRedirect(req, "https://savethreadsvideos.com")).toBeNull();
    // Malformed config must never crash or loop.
    expect(canonicalHostRedirect(req, "not a url")).toBeNull();
  });
});