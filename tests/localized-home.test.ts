import { describe, it, expect } from "vitest";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { HREFLANG_PATHS, LOCALIZED_HOMES, hreflangFor, localizedHomeFor } from "../src/lib/localized-home";
import { renderStaticRoute } from "../src/server/content/render";
import { sitemapXml } from "../src/server/worker";

const ORIGIN = "https://www.savethreadsvideos.com";

function route(path: string) {
  const r = SEO_ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`missing route ${path}`);
  return r;
}

function render(path: string): string {
  return renderStaticRoute(null, ORIGIN, "/og-image.png", route(path));
}

function mainText(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("localized homepages (/ar, /fr)", () => {
  it("registers both localized routes exactly once", () => {
    for (const page of LOCALIZED_HOMES) {
      expect(SEO_ROUTES.filter((r) => r.path === page.path), page.path).toHaveLength(1);
      expect(localizedHomeFor(page.path)).toBe(page);
    }
    expect(localizedHomeFor("/")).toBeUndefined();
    expect(localizedHomeFor("/fr/nope")).toBeUndefined();
  });

  it("does not reuse the English title, description or H1", () => {
    const english = route("/");
    const titles = new Set([english.title]);
    const descs = new Set([english.description]);
    const h1s = new Set([english.h1]);
    for (const page of LOCALIZED_HOMES) {
      expect(titles.has(page.title), `${page.path} title`).toBe(false);
      expect(descs.has(page.description), `${page.path} description`).toBe(false);
      expect(h1s.has(page.h1), `${page.path} h1`).toBe(false);
      titles.add(page.title);
      descs.add(page.description);
      h1s.add(page.h1);
    }
  });

  it("server-renders real localized HTML with the right language and direction", () => {
    for (const page of LOCALIZED_HOMES) {
      const html = render(page.path);
      expect(html).toContain(`<html lang="${page.lang}" dir="${page.dir}">`);
      expect(html).toContain(`<main lang="${page.lang}" dir="${page.dir}">`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${page.h1}</h1>`);
      expect(html).toContain(`rel="canonical" href="${ORIGIN}${page.path}"`);
      for (const s of page.sections) expect(html, `${page.path} ${s.h2}`).toContain(`<h2>${s.h2}</h2>`);
      for (const f of page.faqs) {
        expect(html, `${page.path} question ${f.q}`).toContain(f.q);
        expect(html, `${page.path} answer ${f.q}`).toContain(f.a);
      }
      expect(html).toContain(`<h2>${page.faqTitle}</h2>`);
      // Substantive enough not to be a thin translated stub.
      expect(mainText(html).split(/\s+/).filter(Boolean).length, page.path).toBeGreaterThanOrEqual(250);
    }
  });

  it("declares a complete hreflang cluster on every language version", () => {
    for (const path of HREFLANG_PATHS) {
      const html = render(path);
      for (const p of HREFLANG_PATHS) {
        const lang = p === "/" ? "en" : p.slice(1);
        expect(html, `${path} → ${p}`).toContain(
          `<link rel="alternate" hreflang="${lang}" href="${ORIGIN}${p === "/" ? "/" : p}" />`,
        );
      }
      expect(html, path).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`);
      // Each language version stays self-canonical: an alternate is a
      // translation, not a duplicate to consolidate.
      expect(html, path).toContain(`rel="canonical" href="${ORIGIN}${path}"`);
    }
  });

  it("keeps hreflang off pages that have no translation", () => {
    expect(hreflangFor("/faq")).toBeNull();
    expect(render("/faq")).not.toContain('hreflang="ar"');
  });

  it("ships matching FAQPage + WebApplication structured data", () => {
    for (const page of LOCALIZED_HOMES) {
      const html = render(page.path);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
        (m) => JSON.parse(m[1]) as { "@type"?: string; inLanguage?: string; mainEntity?: unknown[] },
      );
      const app = blocks.find((b) => b["@type"] === "WebApplication");
      expect(app, page.path).toBeDefined();
      expect(app?.inLanguage).toBe(page.lang);
      const faq = blocks.find((b) => b["@type"] === "FAQPage");
      expect(faq?.mainEntity).toHaveLength(page.faqs.length);
      expect(html).not.toContain("aggregateRating");
    }
  });

  it("keeps the site's claim rules in every language", () => {
    const banned = [/100\s*%/i, /unlimited/i, /guarantee/i, /watermark[- ]free/i, /#1\b/, /\bbest\b/i];
    for (const page of LOCALIZED_HOMES) {
      const text = [
        page.title,
        page.description,
        page.intro,
        ...page.sections.flatMap((s) => [s.h2, ...s.body, ...(s.bullets ?? [])]),
        ...page.faqs.flatMap((f) => [f.q, f.a]),
      ].join(" ");
      for (const re of banned) expect(re.test(text), `${page.path} matched ${re}`).toBe(false);
      // The honest limits must actually be stated, not implied.
      expect(text).toMatch(/خاص|privé/i);
      expect(text).toMatch(/مجان|gratuit/i);
    }
  });

  it("appears in the sitemap with a content date", () => {
    const xml = sitemapXml(ORIGIN);
    for (const page of LOCALIZED_HOMES) {
      expect(xml).toContain(`<loc>${ORIGIN}${page.path}</loc>`);
      const r = route(page.path);
      expect(xml).toContain(`<loc>${ORIGIN}${page.path}</loc><lastmod>${r.updated}</lastmod>`);
    }
  });
});
