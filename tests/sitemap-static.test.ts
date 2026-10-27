import { describe, it, expect } from "vitest";
import { buildSitemapXml, buildRobotsTxt, escapeXml, isSafeSlug, encodeLoc } from "../scripts/gen-static-seo.mjs";

const ORIGIN = "https://savethreadsvideos.com";
const STATIC = ["/", "/faq", "/blog"];
const ARABIC = "تحميل-فيديو-ثريدز";
const TOOLS = [
  { slug: "threads-video-downloader-hd", updated_at: "2026-10-06T00:00:00Z" },
  { slug: ARABIC, updated_at: "2026-10-07T12:00:00Z" },
];
const GUIDES = [{ slug: "save-threads-carousel-photos", updated_at: "2026-10-05T00:00:00Z" }];

function locs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

describe("static sitemap enrichment (build-time)", () => {
  it("merges static paths with live DB slugs", () => {
    const xml = buildSitemapXml(ORIGIN, STATIC, TOOLS, GUIDES);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/faq</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/threads-video-downloader-hd</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/blog/save-threads-carousel-photos</loc>`);
    // Arabic slugs are percent-encoded (same form the Worker sitemap emits).
    const arabic = locs(xml).find((u) => u.includes("%"));
    expect(arabic).toBe(`${ORIGIN}/${encodeURIComponent(ARABIC)}`);
    expect(decodeURIComponent(String(arabic))).toBe(`${ORIGIN}/${ARABIC}`);
  });
  it("emits real lastmod dates from updated_at (never faked)", () => {
    const xml = buildSitemapXml(ORIGIN, STATIC, TOOLS, GUIDES);
    expect(xml).toContain("<lastmod>2026-10-06</lastmod>");
    expect(xml).toContain("<lastmod>2026-10-07</lastmod>");
    // Static registry entries carry no lastmod.
    const faqEntry = xml.match(/<url><loc>[^<]*\/faq<\/loc>(.*?)<\/url>/)?.[1] ?? "missing";
    expect(faqEntry).not.toContain("lastmod");
  });
  it("dedupes loc collisions and skips unsafe slugs", () => {
    const xml = buildSitemapXml(
      ORIGIN,
      ["/threads-video-downloader-hd", "/faq"],
      [...TOOLS, { slug: "../evil", updated_at: "" }, { slug: "", updated_at: "" }],
      [{ slug: "ok-guide", updated_at: "not-a-date" }],
    );
    const all = locs(xml);
    expect(new Set(all).size).toBe(all.length);
    expect(xml).not.toContain("evil");
    // Invalid date strings never become lastmod.
    expect(xml).not.toContain("<lastmod>not-a-date</lastmod>");
  });
  it("escapes XML special chars in locs", () => {
    expect(escapeXml('a&b"c<d>e\'f')).toBe("a&amp;b&quot;c&lt;d&gt;e&apos;f");
  });
  it("isSafeSlug mirrors the server slug rules", () => {
    expect(isSafeSlug("threads-video-downloader-hd")).toBe(true);
    expect(isSafeSlug(ARABIC)).toBe(true);
    expect(isSafeSlug("")).toBe(false);
    expect(isSafeSlug("../traversal")).toBe(false);
    expect(isSafeSlug("UPPERCASE")).toBe(false);
    expect(isSafeSlug("with space")).toBe(false);
  });
  it("encodeLoc keeps ASCII URLs byte-identical", () => {
    expect(encodeLoc(`${ORIGIN}/faq`)).toBe(`${ORIGIN}/faq`);
    expect(encodeLoc(`${ORIGIN}/`)).toBe(`${ORIGIN}/`);
    expect(encodeLoc(`${ORIGIN}/blog/some-guide`)).toBe(`${ORIGIN}/blog/some-guide`);
    expect(encodeLoc("not a url")).toBe("not a url");
  });
  it("robots references the canonical sitemap on the apex host", () => {
    const robots = buildRobotsTxt(ORIGIN);
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(robots).not.toContain("www.");
  });
});
