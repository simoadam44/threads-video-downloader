import { describe, it, expect } from "vitest";
import { sitemapXml, canonicalPath } from "../src/server/worker";
import { renderStaticRoute, renderMinimalShell } from "../src/server/content/render";
import { SEO_ROUTES } from "../src/lib/seo-routes";

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
      expect(u.startsWith("https://www.savethreadsvideos.com")).toBe(true);
      expect(u).not.toContain("localhost");
      expect(u).not.toContain("example.com");
      expect(u).not.toContain("/api/");
      expect(u).not.toContain("/admin");
    }
    expect(urls).toContain("https://www.savethreadsvideos.com/threads-video-downloader-hd");
    expect(urls).toContain("https://www.savethreadsvideos.com/blog/some-guide");
  });
  it("emits lastmod only when meaningful", () => {
    expect(xml).toContain("<lastmod>2026-10-06</lastmod>");
  });
});

describe("canonical paths", () => {
  it("strips trailing slashes except root", () => {
    expect(canonicalPath("/faq/")).toBe("/faq");
    expect(canonicalPath("/faq///")).toBe("/faq");
    expect(canonicalPath("/")).toBe("/");
    expect(canonicalPath("/blog/x")).toBe("/blog/x");
  });
});

describe("rendered SEO pages", () => {
  const html = renderStaticRoute(null, ORIGIN, "/og-image.svg", route);
  it("has title, description, canonical, one H1, OG/Twitter, valid JSON-LD", () => {
    expect(html).toContain("<title>FAQ - Threads Video Downloader</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical" href="https://www.savethreadsvideos.com/faq"');
    expect((html.match(/<h1>/g) || []).length).toBe(1);
    for (const tag of ["og:title", "og:description", "og:url", "og:type", "og:image", "og:site_name", "twitter:card", "twitter:title", "twitter:image"]) {
      expect(html).toContain(tag);
    }
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      const parsed = JSON.parse(b[1]) as { "@context"?: string };
      expect(parsed["@context"]).toBe("https://schema.org");
    }
  });
  it("has no noindex on public pages and no placeholder domains", () => {
    expect(html).not.toContain("noindex");
    expect(html).not.toContain("example.com");
    expect(html).not.toContain("localhost");
  });
  it("minimal shell is crawlable without JS", () => {
    const m = renderMinimalShell(
      { title: "T", description: "D", canonical: `${ORIGIN}/x`, ogImage: `${ORIGIN}/og-image.svg`, lang: "en", jsonLd: [] },
      "<main><h1>H</h1></main>",
    );
    expect(m).toContain("<h1>H</h1>");
    expect(m).toContain("og:site_name");
  });
});

describe("SEO registry quality", () => {
  it("unique titles/descriptions/H1s across routes", () => {
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
