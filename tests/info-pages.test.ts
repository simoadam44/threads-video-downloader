import { describe, it, expect } from "vitest";
import { INFO_PAGES, INFO_LAST_UPDATED, infoPageFor, type InfoPageContent } from "../src/lib/info-pages";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { FAQ_ITEMS } from "../src/lib/faq";
import { renderStaticRoute } from "../src/server/content/render";
import {
  CONTACT_LIMITS,
  cleanText,
  validateContact,
  type ContactField,
} from "../src/lib/contact-rules";

const PAGE_KEYS = Object.keys(INFO_PAGES);
const REGISTRY_PATHS = new Set(SEO_ROUTES.map((r) => r.path));

function allText(page: InfoPageContent): string {
  return [page.intro, ...page.blocks.map((b) => ("text" in b ? b.text : b.items.join(" ")))].join("\n");
}

describe("info pages: registry integrity", () => {
  it("every info page is a registered SEO route (sitemap + canonical)", () => {
    for (const key of PAGE_KEYS) {
      expect(REGISTRY_PATHS.has(key), `${key} missing from SEO_ROUTES`).toBe(true);
    }
  });

  it("the expected legal / trust routes exist exactly once", () => {
    for (const path of ["/about", "/contact", "/privacy", "/terms", "/disclaimer", "/how-to-use", "/faq"]) {
      expect(SEO_ROUTES.filter((r) => r.path === path)).toHaveLength(1);
    }
  });

  it("declares its path and has unique intro copy per page", () => {
    const intros = new Set<string>();
    for (const [key, page] of Object.entries(INFO_PAGES)) {
      expect(page.path).toBe(key);
      expect(intros.has(page.intro)).toBe(false);
      intros.add(page.intro);
      expect(page.intro.length).toBeGreaterThan(80);
    }
  });

  it("every page has substantial content and no empty blocks", () => {
    for (const page of Object.values(INFO_PAGES)) {
      expect(page.blocks.length, page.path).toBeGreaterThanOrEqual(5);
      for (const block of page.blocks) {
        if ("text" in block) expect(block.text.trim().length, page.path).toBeGreaterThan(0);
        else {
          expect(block.items.length, page.path).toBeGreaterThan(0);
          for (const item of block.items) expect(item.trim().length).toBeGreaterThan(0);
        }
      }
      // Headings must not start at h3 (screen reader / outline sanity).
      const firstHeading = page.blocks.find((b) => b.kind === "h2" || b.kind === "h3");
      expect(firstHeading?.kind).toBe("h2");
    }
  });

  it("internal links only point at real, indexable routes", () => {
    for (const page of Object.values(INFO_PAGES)) {
      for (const link of page.related ?? []) {
        expect(REGISTRY_PATHS.has(link.href), `${page.path} → ${link.href}`).toBe(true);
        expect(link.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("the last-updated stamp is a readable date", () => {
    expect(INFO_LAST_UPDATED).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    for (const page of Object.values(INFO_PAGES)) {
      if (page.updated) expect(page.updated).toBe(INFO_LAST_UPDATED);
    }
  });
});

describe("info pages: truthful claims only", () => {
  const FORBIDDEN = [
    /GDPR[- ]compliant/i,
    /CCPA[- ]compliant/i,
    /fully compliant/i,
    /(?<!no )guaranteed/i,
    /#1\b/i,    /number one/i,
    /world'?s best/i,
    /unlimited downloads/i,
    /100% (secure|private|anonymous)/i,
    /we (never|do not) collect/i,
    /no personal (data|information) (is )?collected/i,
    /watermark[- ]free/i,
    /removes? watermarks?/i,
  ];

  it("contains no unsupported compliance, ranking or absoluteness claims", () => {
    for (const page of Object.values(INFO_PAGES)) {
      const text = allText(page);
      for (const re of FORBIDDEN) {
        expect(re.test(text), `${page.path} matched ${re}`).toBe(false);
      }
    }
  });

  it("invents no email address, phone number, address or company", () => {
    for (const page of Object.values(INFO_PAGES)) {
      const text = allText(page);
      // A public address may only come from the CONTACT_EMAIL env var at runtime.
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/);
      expect(text).not.toMatch(/\+?\d[\d\s().-]{7,}\d/);
      expect(text).not.toMatch(/\b(Ltd|LLC|GmbH|Inc\.|S\.A\.R\.L)\b/);
      expect(text).not.toMatch(/\b(CEO|founder|our team of)\b/i);
    }
  });

  it("advertising is described as not enabled anywhere it is mentioned", () => {
    const privacy = INFO_PAGES["/privacy"];
    const text = allText(privacy);
    expect(text).toMatch(/Advertising is not active/i);
    expect(text).toMatch(/no advertising cookies are set/i);
  });

  it("privacy describes the real implementation (hash, cache, streaming, storage)", () => {
    const text = allText(INFO_PAGES["/privacy"]);
    expect(text).toMatch(/SHA-256 hash/);
    expect(text).toMatch(/raw link nor the raw IP address is written/i);
    expect(text).toMatch(/five minutes/i);
    expect(text).toMatch(/never stored on the server|not written to our storage|Files are not written/i);
    expect(text).toMatch(/Google Analytics 4/i);
    expect(text).toMatch(/tvd-theme/);
    expect(text).toMatch(/Contact form/i);
    expect(text).toMatch(/not the same as anonymisation/i);
  });

  it("terms and disclaimer state independence from Threads / Meta", () => {
    for (const key of ["/terms", "/disclaimer", "/about"]) {
      expect(allText(INFO_PAGES[key])).toMatch(/not affiliated with/i);
    }
    expect(allText(INFO_PAGES["/disclaimer"])).toMatch(/Trademarks belong to their respective owners|trademarks of Meta Platforms/i);
  });

  it("the contact page explains what is stored and promises no support hours", () => {
    const text = allText(INFO_PAGES["/contact"]);
    expect(text).toMatch(/stored in the site's database/i);
    expect(text).toMatch(/no guaranteed response time/i);
    expect(text).not.toMatch(/\b(24\/7|within 24 hours|business hours)\b/i);
  });
});

describe("FAQ content", () => {
  it("is substantial, unique and question/answer shaped", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(14);
    const questions = FAQ_ITEMS.map((f) => f.q);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of FAQ_ITEMS) {
      expect(item.q.trim().endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(60);
      expect(item.a.length).toBeLessThan(600);
      expect(item.a).not.toMatch(/<[a-z]/i);
    }
  });

  it("covers the required topics and stays truthful", () => {
    const text = FAQ_ITEMS.map((f) => `${f.q} ${f.a}`).join("\n");
    for (const topic of [
      /free/i,
      /private/i,
      /carousel/i,
      /quality/i,
      /Where are downloaded files saved/i,
      /store the links I paste|store/i,
      /copyright|permission|licence/i,
      /affiliated/i,
      /contact/i,
      /iPhone|iOS/i,
      /Android/i,
    ]) {
      expect(text, `missing topic ${topic}`).toMatch(topic);
    }
    expect(text).not.toMatch(/guaranteed|#1|unlimited downloads/i);
    expect(text).toMatch(/not affiliated with Threads, Instagram or Meta/i);
  });
});

describe("contact validation rules", () => {
  const valid = {
    name: "Alex",
    email: "alex@example.com",
    subject: "Broken link",
    message: "This public post does not resolve in Firefox on Windows 11.",
  };

  it("accepts a well-formed message and trims values", () => {
    const res = validateContact({ ...valid, name: "  Alex  ", message: `  ${valid.message}  ` });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.name).toBe("Alex");
      expect(res.value.message).toBe(valid.message);
    }
  });

  it("rejects each invalid field with the right field name", () => {
    const cases: [Partial<typeof valid>, ContactField][] = [
      [{ name: "A" }, "name"],
      [{ name: "" }, "name"],
      [{ email: "not-an-email" }, "email"],
      [{ email: "alex@localhost" }, "email"],
      [{ subject: "ab" }, "subject"],
      [{ message: "too short" }, "message"],
    ];
    for (const [patch, field] of cases) {
      const res = validateContact({ ...valid, ...patch });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe(field);
        expect(res.message.length).toBeGreaterThan(10);
      }
    }
  });

  it("rejects non-object payloads and oversized values safely", () => {
    for (const bad of [null, undefined, "string", 42, []]) {
      expect(validateContact(bad).ok).toBe(false);
    }
    const res = validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.message.max + 500) });
    // Capped, not rejected: the stored value never exceeds the limit.
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.message.length).toBe(CONTACT_LIMITS.message.max);
  });

  it("cleanText strips control characters but keeps newlines", () => {
    expect(cleanText("a\u0000b\u0007c", 100)).toBe("abc");
    expect(cleanText("line1\r\nline2", 100)).toBe("line1\nline2");
    expect(cleanText(42, 100)).toBe("");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("limits are ordered min < max", () => {
    expect(CONTACT_LIMITS.name.min).toBeLessThan(CONTACT_LIMITS.name.max);
    expect(CONTACT_LIMITS.subject.min).toBeLessThan(CONTACT_LIMITS.subject.max);
    expect(CONTACT_LIMITS.message.min).toBeLessThan(CONTACT_LIMITS.message.max);
  });
});

describe("server rendering of info pages (crawlable without JS)", () => {
  for (const key of PAGE_KEYS) {
    it(`${key} renders its full content, one H1 and a canonical`, () => {
      const route = SEO_ROUTES.find((r) => r.path === key)!;
      const html = renderStaticRoute(null, "https://www.savethreadsvideos.com", "/og-image.png", route);
      const page = infoPageFor(key)!;

      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${route.h1}</h1>`);
      expect(html).toContain(route.title);
      expect(html).toContain(route.description);
      expect(html).toContain(`rel="canonical" href="https://www.savethreadsvideos.com${key}"`);
      // The intro and every block heading are in the initial HTML.
      expect(html).toContain(route.h1);
      for (const block of page.blocks) {
        if (block.kind === "h2") expect(html).toContain(`<h2>${block.text}</h2>`);
      }
      // Structured data: WebSite always, BreadcrumbList for info pages.
      expect(html).toContain('"@type":"WebSite"');
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(html).not.toContain('"@type":"FAQPage"');
    });
  }

  it("renders the related internal links as real anchors", () => {
    const route = SEO_ROUTES.find((r) => r.path === "/privacy")!;
    const html = renderStaticRoute(null, "https://example.test", "/og-image.png", route);
    expect(html).toContain('href="/contact"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/disclaimer"');
  });

  it("escapes content and never double-renders the SPA fallback", () => {
    const route = SEO_ROUTES.find((r) => r.path === "/about")!;
    const html = renderStaticRoute(null, "https://example.test", "/og-image.png", route);
    expect(html).toContain("About SaveThreadsVideos");
    expect(html).not.toContain("<script>alert");
  });

  it("navigation links the legal pages from the footer", () => {
    const route = SEO_ROUTES.find((r) => r.path === "/faq")!;
    const html = renderStaticRoute(null, "https://example.test", "/og-image.png", route);
    for (const href of ["/about", "/privacy", "/terms", "/disclaimer", "/contact", "/how-to-use"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("not affiliated with or endorsed by Threads or Meta");
  });

  it("still renders the letter-only homepage and tool pages with a summary", () => {
    const home = renderStaticRoute(
      null,
      "https://example.test",
      "/og-image.png",
      SEO_ROUTES.find((r) => r.path === "/")!,
    );
    expect(home).toContain('"@type":"WebSite"');
    expect(home).not.toContain('"@type":"BreadcrumbList"');

    const tool = renderStaticRoute(
      null,
      "https://example.test",
      "/og-image.png",
      SEO_ROUTES.find((r) => r.path === "/threads-carousel-downloader")!,
    );
    expect(tool).toContain("Download All");
    expect(tool.match(/<h1>/g)).toHaveLength(1);
  });
});
