import { describe, expect, it } from "vitest";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { TOOL_CONTENT, toolContentFor } from "../src/lib/tool-content";
import { renderStaticRoute } from "../src/server/content/render";

const TOOL_PATHS = ["/threads-video-downloader", "/threads-photo-downloader", "/threads-carousel-downloader"];

function routeFor(path: string) {
  const route = SEO_ROUTES.find((r) => r.path === path);
  if (!route) throw new Error(`missing route ${path}`);
  return route;
}

function render(path: string): string {
  return renderStaticRoute(null, "https://www.savethreadsvideos.com", "/og-image.png", routeFor(path));
}

function words(content: { sections: { body: string[]; bullets?: string[] }[]; faqs: { q: string; a: string }[] }): number {
  const text = [
    ...content.sections.flatMap((s) => [...s.body, ...(s.bullets ?? [])]),
    ...content.faqs.flatMap((f) => [f.q, f.a]),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

describe("tool landing page content", () => {
  it("covers exactly the three primary tool pages", () => {
    expect(Object.keys(TOOL_CONTENT).sort()).toEqual([...TOOL_PATHS].sort());
    for (const path of TOOL_PATHS) {
      expect(toolContentFor(path), `${path} has no content`).toBeDefined();
      expect(SEO_ROUTES.filter((r) => r.path === path)).toHaveLength(1);
    }
    expect(toolContentFor("/how-to-download-threads-videos")).toBeUndefined();
    expect(toolContentFor("/blog")).toBeUndefined();
  });

  it("is substantive enough to avoid thin-content pages", () => {
    for (const path of TOOL_PATHS) {
      const content = toolContentFor(path)!;
      expect(content.sections.length, `${path} sections`).toBeGreaterThanOrEqual(3);
      expect(content.faqs.length, `${path} faqs`).toBeGreaterThanOrEqual(4);
      expect(words(content), `${path} word count`).toBeGreaterThanOrEqual(350);
      for (const s of content.sections) {
        expect(s.h2.length).toBeGreaterThan(10);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("stays inside the site's claim rules", () => {
    // Mirrors the rules in tests/info-pages.test.ts: this tool does not remove
    // watermarks, has no unlimited tier and cannot guarantee a quality or speed.
    const banned = [/unlimited/i, /guarantee/i, /watermark[- ]free/i, /without watermark/i, /\bbest\b/i, /fastest/i, /#1\b/, /\b100%\s*(?:free|safe|secure|anonymous)/i];
    for (const path of TOOL_PATHS) {
      const content = toolContentFor(path)!;
      const text = [
        ...content.sections.flatMap((s) => [s.h2, ...s.body, ...(s.bullets ?? [])]),
        ...content.faqs.flatMap((f) => [f.q, f.a]),
      ].join(" ");
      for (const re of banned) {
        expect(text, `${path} matches ${re}`).not.toMatch(re);
      }
    }
  });

  it("pre-renders every section and answer before hydration", () => {
    for (const path of TOOL_PATHS) {
      const html = render(path);
      const content = toolContentFor(path)!;
      expect(html.match(/<h1>/g), `${path} h1 count`).toHaveLength(1);
      expect(html).toContain(`rel="canonical" href="https://www.savethreadsvideos.com${path}"`);
      for (const section of content.sections) {
        expect(html, `${path} missing ${section.h2}`).toContain(`<h2>${section.h2}</h2>`);
      }
      for (const faq of content.faqs) {
        expect(html, `${path} missing answer for ${faq.q}`).toContain(faq.q);
        expect(html).toContain(faq.a);
      }
      // Structured data matches what the visitor can actually read.
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(html).not.toContain("Fast and easy");
    }
  });

  it("does not attach tool FAQs or breadcrumbs to other registry routes", () => {
    for (const path of ["/", "/how-to-download-threads-videos", "/blog"]) {
      const html = render(path);
      expect(html, `${path} should not emit FAQPage`).not.toContain('"@type":"FAQPage"');
    }
    expect(render("/").match(/<h1>/g)).toHaveLength(1);
  });
});
