import { describe, it, expect } from "vitest";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { HOME_FAQS, HOME_LINKS, HOME_SECTIONS } from "../src/lib/home-content";
import { renderStaticRoute } from "../src/server/content/render";

const ORIGIN = "https://www.savethreadsvideos.com";

function home(): string {
  const route = SEO_ROUTES.find((r) => r.path === "/");
  if (!route) throw new Error("homepage missing from SEO_ROUTES");
  return renderStaticRoute(null, ORIGIN, "/og-image.png", route);
}

/** Visible text inside <main>, tags stripped. */
function mainText(html: string): string {
  const main = html.match(/<main>([\s\S]*?)<\/main>/)?.[1] ?? "";
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonLd(html: string): { "@type"?: string; mainEntity?: unknown[] }[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]) as { "@type"?: string; mainEntity?: unknown[] },
  );
}

describe("homepage crawlable content", () => {
  // Regression guard for the defect this content was written to fix: the
  // homepage carried ~97% of impressions while its HTML held 33 words, no
  // <h2> and no structured data describing the tool.
  it("carries a substantive body, not a single sentence", () => {
    const html = home();
    expect(mainText(html).split(/\s+/).length).toBeGreaterThanOrEqual(700);
    expect((html.match(/<h2>/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });

  it("pre-renders every section heading and paragraph", () => {
    const html = home();
    for (const section of HOME_SECTIONS) {
      expect(html, `missing section: ${section.h2}`).toContain(`<h2>${section.h2}</h2>`);
      for (const p of section.body) {
        expect(html, `missing paragraph in ${section.h2}`).toContain(p);
      }
      for (const b of section.bullets ?? []) expect(html).toContain(b);
    }
  });

  it("pre-renders the FAQ answers and matches the FAQPage schema to them", () => {
    const html = home();
    for (const f of HOME_FAQS) {
      expect(html, `missing question: ${f.q}`).toContain(f.q);
      expect(html, `missing answer: ${f.q}`).toContain(f.a);
    }
    const faq = jsonLd(html).find((b) => b["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    expect(faq?.mainEntity).toHaveLength(HOME_FAQS.length);
  });

  it("describes the application itself, without invented ratings", () => {
    const html = home();
    const app = jsonLd(html).find((b) => b["@type"] === "WebApplication");
    expect(app).toBeDefined();
    expect(html).toContain('"applicationCategory":"MultimediaApplication"');
    expect(html).toContain('"isAccessibleForFree":true');
    expect(html).not.toContain("aggregateRating");
    expect(html).not.toContain("reviewCount");
  });

  it("links out to the pages that own each intent", () => {
    const html = home();
    for (const link of HOME_LINKS) {
      expect(html, `missing link ${link.href}`).toContain(`href="${link.href}"`);
      expect(html).toContain(link.label);
    }
    // …and to the three product pages even when the card list changes.
    for (const href of ["/threads-video-downloader", "/threads-photo-downloader", "/threads-carousel-downloader"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("keeps the homepage FAQ out of /faq (no duplicated Q&A block)", () => {
    const faqRoute = SEO_ROUTES.find((r) => r.path === "/faq");
    if (!faqRoute) throw new Error("faq route missing");
    const faqHtml = renderStaticRoute(null, ORIGIN, "/og-image.png", faqRoute);
    for (const f of HOME_FAQS) {
      expect(faqHtml, `/faq duplicates the homepage question: ${f.q}`).not.toContain(f.q);
    }
  });

  it("stays inside the site's claim rules", () => {
    const banned = [
      /unlimited/i,
      /guarantee/i,
      /watermark[- ]free/i,
      /without watermark/i,
      /\bbest\b/i,
      /fastest/i,
      /#1\b/,
      /\b100%\s*(?:free|safe|secure|anonymous)/i,
    ];
    const text = [
      ...HOME_SECTIONS.flatMap((s) => [s.h2, ...s.body, ...(s.bullets ?? [])]),
      ...HOME_FAQS.flatMap((f) => [f.q, f.a]),
      ...HOME_LINKS.map((l) => `${l.label} ${l.summary}`),
    ].join(" ");
    for (const re of banned) expect(text, `homepage matches ${re}`).not.toMatch(re);
  });

  it("keeps the canonical, robots and social metadata intact", () => {
    const html = home();
    expect(html).toContain(`rel="canonical" href="${ORIGIN}/"`);
    expect(html).not.toContain("noindex");
    expect(html).toContain('og:type" content="website"');
    expect(html).toContain("twitter:card");
  });
});
