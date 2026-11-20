import { describe, it, expect } from "vitest";
import { caseCanonicalPath, notFoundPage, sitemapXml } from "../src/server/worker";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { renderStaticRoute } from "../src/server/content/render";
import { BLOG_INTRO, BLOG_LINKS, BLOG_SECTIONS } from "../src/lib/blog-content";
import { infoPageFor } from "../src/lib/info-pages";
import { buildSitemapXml } from "../scripts/gen-static-seo.mjs";

const ORIGIN = "https://www.savethreadsvideos.com";
// Authors date content by their local day; UTC can be up to a day behind, so the
// guard allows that single day of slack and rejects anything further ahead.
const LATEST_ALLOWED = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** Words a crawler sees inside <main> once chrome/navigation is discounted. */
function mainWords(html: string): number {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function route(path: string) {
  const r = SEO_ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`missing route ${path}`);
  return r;
}

describe("static routes carry an honest content date", () => {
  it("every registry route has a valid, non-future YYYY-MM-DD date", () => {
    for (const r of SEO_ROUTES) {
      expect(r.updated, `${r.path} has no updated date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.updated! <= LATEST_ALLOWED, `${r.path} date is in the future`).toBe(true);
    }
  });

  it("the Worker sitemap emits <lastmod> for every static route", () => {
    const xml = sitemapXml(ORIGIN);
    for (const r of SEO_ROUTES) {
      const entry = xml.match(new RegExp(`<url><loc>[^<]*${r.path === "/" ? "" : r.path}</loc>([\\s\\S]*?)</url>`));
      expect(entry, `${r.path} missing from sitemap`).not.toBeNull();
      expect(entry?.[1], `${r.path} has no lastmod`).toContain(`<lastmod>${r.updated}</lastmod>`);
    }
  });

  it("the build-time sitemap matches the Worker sitemap (same URLs, same dates)", () => {
    const workerXml = sitemapXml(ORIGIN);
    const staticXml = buildSitemapXml(
      ORIGIN,
      SEO_ROUTES.map((r) => ({ path: r.path, updated: r.updated })),
      [],
      [],
    );
    const locs = (x: string) => [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const lastmods = (x: string) => [...x.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    expect(locs(staticXml)).toEqual(locs(workerXml));
    expect(lastmods(staticXml)).toEqual(lastmods(workerXml));
    expect(lastmods(staticXml)).toHaveLength(SEO_ROUTES.length);
  });
});

describe("case-insensitive canonical routes", () => {
  it("301s a differently-cased built-in route to the registry path", () => {
    expect(caseCanonicalPath("/FAQ")).toBe("/faq");
    expect(caseCanonicalPath("/Threads-Video-Downloader")).toBe("/threads-video-downloader");
    expect(caseCanonicalPath("/Terms")).toBe("/terms");
    expect(caseCanonicalPath("/Sitemap.xml")).toBe("/sitemap.xml");
    expect(caseCanonicalPath("/Robots.txt")).toBe("/robots.txt");
  });

  it("normalises a trailing slash in the same hop (no redirect chain)", () => {
    expect(caseCanonicalPath("/FAQ/")).toBe("/faq");
    expect(caseCanonicalPath("/Blog//")).toBe("/blog");
  });

  it("leaves canonical, unknown, API, asset and Arabic paths alone", () => {
    for (const p of [
      "/",
      "/faq",
      "/threads-video-downloader",
      "/blog/some-guide",
      "/api/resolve",
      "/admin",
      "/assets/index-abc.js",
      "/nope",
      "/%D8%AA%D8%AD%D9%85%D9%8A%D9%84-%D9%81%D9%8A%D8%AF%D9%8A%D9%88-%D8%AB%D8%B1%D9%8A%D8%AF%D8%B2",
    ]) {
      expect(caseCanonicalPath(p), p).toBeNull();
    }
  });
});

describe("error pages are not indexable at the HTTP level", () => {
  it("404 and 410 carry X-Robots-Tag and a real status", () => {
    for (const status of [404, 410]) {
      const res = notFoundPage(ORIGIN, status);
      expect(res.status).toBe(status);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("/blog hub content", () => {
  it("carries substantial, unique copy instead of a bare link list", () => {
    const words = [BLOG_INTRO, ...BLOG_SECTIONS.flatMap((s) => [s.h2, ...s.body])]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(300);
    expect(BLOG_SECTIONS.length).toBeGreaterThanOrEqual(3);
    const headings = BLOG_SECTIONS.map((s) => s.h2);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("keeps the site's claim rules", () => {
    const text = [BLOG_INTRO, ...BLOG_SECTIONS.flatMap((s) => s.body)].join("\n");
    for (const re of [/unlimited/i, /watermark[- ]free/i, /guarantee/i, /#1\b/, /best\b/i, /\d+ users/i]) {
      expect(re.test(text), `matched ${re}`).toBe(false);
    }
    expect(text).toMatch(/public/i);
    expect(text).toMatch(/private/i);
  });

  it("only links to indexable registry routes", () => {
    const paths = new Set(SEO_ROUTES.map((r) => r.path));
    for (const l of BLOG_LINKS) {
      expect(paths.has(l.href), l.href).toBe(true);
      expect(l.summary.length).toBeGreaterThan(20);
    }
  });

  it("is server-rendered without JavaScript (copy + guide list)", () => {
    const html = renderStaticRoute(null, ORIGIN, "/og-image.png", route("/blog"), undefined, undefined, [
      { slug: "how-to-download-threads-videos-on-android", title: "How to Download Threads Videos on Android" },
    ]);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    for (const s of BLOG_SECTIONS) expect(html).toContain(`<h2>${s.h2}</h2>`);
    expect(html).toContain('href="/blog/how-to-download-threads-videos-on-android"');
    for (const l of BLOG_LINKS) expect(html).toContain(`href="${l.href}"`);
    expect(mainWords(html)).toBeGreaterThanOrEqual(250);
  });
});

describe("/contact is no longer a thin page", () => {
  it("renders well over 300 words of body copy", () => {
    const html = renderStaticRoute(null, ORIGIN, "/og-image.png", route("/contact"));
    const page = infoPageFor("/contact");
    expect(page).not.toBeNull();
    expect(mainWords(html)).toBeGreaterThanOrEqual(300);
    expect(html).toContain("<h2>Reporting a post that will not save</h2>");
    expect(html).toContain("<h2>What happens after you write</h2>");
  });
});
