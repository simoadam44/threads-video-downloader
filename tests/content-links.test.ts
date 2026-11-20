import { describe, it, expect } from "vitest";
import { repairContentLinks } from "../src/server/content/links";
import { renderGuide, renderToolPage } from "../src/server/content/render";
import { GONE_PATHS, RETIRED_GUIDE_SLUGS, RETIRED_TOOL_SLUGS } from "../src/server/content/redirects";
import { handlePublicContent, handleStaticSeo } from "../src/server/worker";
import type { Guide, ToolPage, LinkNode } from "../src/server/content/types";
import type { D1Binding } from "../src/server/db/d1";

// The exact broken fragments served by production before this fix
// (see docs/seo-diagnosis-2026-11-18.md §9). `<a href="/">` was stored where
// `</a>` belonged, and several hrefs point at pages that now answer 301.
const ANDROID_BODY =
  '<p>Switch to your mobile web browser and visit our main portal at ' +
  '<a href="/تنزيل-مقاطع-ثريدز">تنزيل مقاطع ثريدز<a href="/"> or use our dedicated ' +
  '<a href="/threads-video-downloader-hd">threads-video-downloader-hd<a href="/"> interface.</p>' +
  '<p>Review our guidelines for carousels via ' +
  '<a href="/threads-carousel-downloader">threads-carousel-downloader<a href="/">.</p>';

const PC_BODY =
  '<p>Independent platforms like our main <a href="/تحميل-فيديو-ثريدز">تحميل فيديو ثريدز<a href="/"> tool ' +
  'allow you to retrieve public files.</p>' +
  '<ul><li>Navigate to our independent tool page such as ' +
  '<a href="/threads-video-downloader-hd">Threads Video Downloader HD<a href="/"> to begin the operation.</li></ul>' +
  '<p>You can also explore our <a href="/threads-carousel-downloader">Threads Carousel Downloader<a href="/"> ' +
  'for multi-item posts.</p>';

const MP3_BODY =
  '<p>You can check out our dedicated ' +
  '<a href="/threads-video-downloader-web-utility">threads-video-downloader-web-utility<a href="/"> ' +
  'to inspect general media fetching capabilities.</p>' +
  '<p>You may consult our guide on ' +
  '<a href="/blog/threads-to-mp4-conversion-guide">threads-to-mp4-conversion-guide<a href="/"> ' +
  'to understand how formats are handled.</p>' +
  '<p>Review our comprehensive ' +
  '<a href="/blog/blog-mastering-threads-video-downloader-usage">blog-mastering-threads-video-downloader-usage<a href="/"> ' +
  'overview.</p>';

const ORIGIN = "https://www.test.local";

const anchorOpens = (html: string) => (html.match(/<a\b/gi) || []).length;
const anchorCloses = (html: string) => (html.match(/<\/a\s*>/gi) || []).length;

/** True when an `<a>` opens while another anchor is still open (invalid HTML). */
function hasNestedAnchor(html: string): boolean {
  let open = 0;
  for (const m of html.matchAll(/<a\b[^>]*>|<\/a\s*>/gi)) {
    if (/^<\//.test(m[0])) open = Math.max(0, open - 1);
    else {
      if (open > 0) return true;
      open += 1;
    }
  }
  return false;
}

function internalPaths(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith("/") && !href.startsWith("//")) out.add(href.split("#")[0].split("?")[0]);
  }
  return [...out];
}

const RETIRED_PATHS = new Set<string>([
  ...Object.keys(RETIRED_TOOL_SLUGS).map((s) => `/${s}`),
  ...Object.keys(RETIRED_GUIDE_SLUGS).map((s) => `/blog/${s}`),
  ...GONE_PATHS,
]);

describe("repairContentLinks", () => {
  it("closes anchors whose closing tag was stored as <a href=\"/\">", () => {
    const out = repairContentLinks(ANDROID_BODY, ORIGIN);
    expect(anchorOpens(out)).toBe(anchorCloses(out));
    expect(out).not.toContain('<a href="/">');
    expect(out).toContain("</a> or use our dedicated");
    expect(out).toContain("</a> interface.");
    expect(out).toContain("</a>.</p>");
    // Text is preserved verbatim; only the markup is repaired.
    expect(out).toContain("تنزيل مقاطع ثريدز");
    expect(out).toContain("interface.");
  });

  it("sends retired tool links straight to their final 200 destination", () => {
    const out = repairContentLinks(ANDROID_BODY, ORIGIN);
    expect(out).toContain('href="/threads-video-downloader"');
    expect(out).not.toContain("/threads-video-downloader-hd");
  });

  it("repairs the PC guide body and keeps live tool links intact", () => {
    const out = repairContentLinks(PC_BODY, ORIGIN);
    expect(anchorOpens(out)).toBe(anchorCloses(out));
    expect(out).not.toContain('<a href="/">');
    expect(out).not.toContain("/threads-video-downloader-hd");
    expect(out).toContain('href="/threads-video-downloader"');
    expect(out).toContain('href="/threads-carousel-downloader"');
    expect(out).toContain('href="/تحميل-فيديو-ثريدز"');
    expect(out).toContain("</a> tool allow you");
    expect(out).toContain("</a> for multi-item posts.");
  });

  it("rewrites every legacy link inside the MP3 guide body", () => {
    const out = repairContentLinks(MP3_BODY, ORIGIN);
    expect(anchorOpens(out)).toBe(anchorCloses(out));
    expect(out).not.toContain('<a href="/">');
    // retired tool → tool page
    expect(out).toContain('href="/threads-video-downloader"');
    expect(out).not.toContain("/threads-video-downloader-web-utility");
    // retired guide → the page that owns the intent
    expect(out).toContain('href="/how-to-use"');
    expect(out).not.toContain("/blog/threads-to-mp4-conversion-guide");
    expect(out).not.toContain("/blog/blog-mastering-threads-video-downloader-usage");
  });

  it("normalises same-site absolute URLs to root-relative paths", () => {
    const html =
      '<p><a href="https://www.test.local/threads-to-mp3-browser-tool">tool</a> ' +
      '<a href="https://test.local/faq">faq</a></p>';
    const out = repairContentLinks(html, ORIGIN);
    expect(out).toContain('href="/threads-to-mp3-browser-tool"');
    expect(out).toContain('href="/faq"');
    expect(out).not.toContain("https://www.test.local");
    expect(out).not.toContain("https://test.local");
  });

  it("never touches external links, fragments, mailto or protocol-relative URLs", () => {
    const html =
      '<p><a href="https://www.threads.net/@nasa/post/abc">post</a>' +
      '<a href="https://example.com/x">x</a>' +
      '<a href="#section">skip</a>' +
      '<a href="mailto:hi@example.com">mail</a>' +
      '<a href="//cdn.example.com/a.png">cdn</a></p>';
    expect(repairContentLinks(html, ORIGIN)).toBe(html);
  });

  it("keeps a genuine home link that is not a broken closer", () => {
    const html = '<p><a class="brand" href="/">Home</a> and <a href="/">Home</a></p>';
    expect(repairContentLinks(html, ORIGIN)).toBe(html);
  });

  it("is idempotent", () => {
    for (const body of [ANDROID_BODY, PC_BODY, MP3_BODY]) {
      const once = repairContentLinks(body, ORIGIN);
      expect(repairContentLinks(once, ORIGIN)).toBe(once);
    }
  });
});

const link = (kind: LinkNode["kind"], slug: string, title = slug): LinkNode => ({
  kind,
  slug,
  title,
  lang: "en",
  target_keyword: slug.replace(/-/g, " "),
});

const minimalTool: ToolPage = {
  id: 1,
  slug: "threads-to-mp3-browser-tool",
  badge: "AUDIO",
  lang: "en",
  target_keyword: "threads to mp3",
  title: "Threads to MP3 Browser Tool - Save Audio From Public Threads Videos",
  description: "A long enough meta description used by the renderer test to satisfy the SEO shape of a tool page.",
  h1: "Threads to MP3 Browser Tool",
  intro: "x".repeat(120),
  faqs: [],
  related_slugs: [],
  status: "live",
};

const minimalGuide: Guide = {
  id: 1,
  slug: "threads-to-mp3-audio-conversion-tutorial",
  lang: "en",
  target_keyword: "threads to mp3 conversion",
  title: "Threads to MP3 Conversion Workflow Using Browser Tools",
  description: "A long enough meta description used by the renderer test to satisfy the SEO shape of a guide page.",
  h1: "Threads to mp3 conversion workflow using browser tools",
  body: MP3_BODY,
  faqs: [],
  related_slugs: [],
  status: "live",
};

describe("related links use the destination kind, never a guessed prefix", () => {
  it("tool pages link guides under /blog and tools at the root", () => {
    const html = renderToolPage(null, "https://www.test.local", "/og-image.png", minimalTool, [
      link("guide", "how-to-download-threads-videos-on-android"),
      link("tool", "threads-to-mp3-browser-tool"),
      link("guide", "blog-save-threads-video-workflow"), // retired guide
      link("tool", "threads-video-downloader-hd"), // retired tool
    ]);
    expect(html).toContain('href="https://www.test.local/blog/how-to-download-threads-videos-on-android"');
    expect(html).toContain('href="https://www.test.local/threads-to-mp3-browser-tool"');
    expect(html).not.toContain("blog/blog-save-threads-video-workflow");
    expect(html).not.toContain("threads-video-downloader-hd");
  });

  it("guide pages link tools at the root and guides under /blog", () => {
    const html = renderGuide(null, "https://www.test.local", "/og-image.png", minimalGuide, [
      link("tool", "threads-to-mp3-browser-tool"),
      link("guide", "how-to-download-threads-videos-on-android"),
      link("guide", "threads-video-to-mp3-audio-extraction-guide"), // retired guide
      link("tool", "threads-to-mp4-video-conversion-tool"), // retired tool
    ]);
    expect(html).toContain('href="https://www.test.local/threads-to-mp3-browser-tool"');
    expect(html).toContain('href="https://www.test.local/blog/how-to-download-threads-videos-on-android"');
    expect(html).not.toContain("blog/threads-to-mp3-browser-tool");
    expect(html).not.toContain("threads-video-to-mp3-audio-extraction-guide");
    expect(html).not.toContain("threads-to-mp4-video-conversion-tool");
  });
});

/** Minimal in-memory D1 stub (same shape as tests/seo-render.test.ts). */
function fakeD1(toolPages: Record<string, unknown>[], guides: Record<string, unknown>[]) {
  const tables = { tool_pages: toolPages, guides };
  const parse = (q: string, values: unknown[]) => {
    const table = q.includes("tool_pages") ? tables.tool_pages : tables.guides;
    if (q.startsWith("select * from") && q.includes("where slug = ?")) {
      return table.filter((r) => r["slug"] === values[0]);
    }
    if (q.startsWith("select * from")) return [...table];
    if (q.startsWith("select slug")) {
      return table.filter((r) => r["status"] === "live").map((r) => ({ slug: r["slug"], updated_at: "2026-10-06T00:00:00Z" }));
    }
    return [];
  };
  return {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            run: async () => ({}),
            first: async <T,>() => (parse(query, values)[0] ?? null) as T | null,
            all: async <T,>() => ({ results: parse(query, values) as T[] }),
          };
        },
      };
    },
    batch: async () => [],
  } as unknown as D1Binding;
}

function toolRow(slug: string, related: string[] = [], lang = "en") {
  return {
    id: 1,
    slug,
    badge: "TOOL",
    lang,
    target_keyword: slug.replace(/-/g, " "),
    title: `${slug} - a sufficiently long public title for the renderer test`,
    description: "A long enough meta description used by the renderer test to satisfy the SEO shape of a DB row.",
    h1: slug,
    intro: "i".repeat(120),
    faqs: JSON.stringify([]),
    related_slugs: JSON.stringify(related),
    status: "live",
  };
}

function guideRow(slug: string, body: string, related: string[] = []) {
  return {
    id: 1,
    slug,
    lang: "en",
    target_keyword: slug.replace(/-/g, " "),
    title: `${slug} - a sufficiently long public article title for the test suite`,
    description: "A long enough meta description used by the renderer test to satisfy the SEO shape of a DB row.",
    h1: slug,
    body,
    faqs: JSON.stringify([]),
    related_slugs: JSON.stringify(related),
    status: "live",
  };
}

// The live production rows that own the broken links, plus the retired rows
// they used to point at (which must never be linked again).
const TOOLS = [
  toolRow("threads-to-mp3-browser-tool", [
    "threads-to-mp3-audio-conversion-tutorial",
    "blog-extract-audio-from-threads-video",
    "threads-video-to-mp3-audio-extraction-guide",
    "threads-video-downloader-web-utility",
  ]),
  toolRow("threads-carousel-downloader"),
  toolRow("تنزيل-مقاطع-ثريدز", [], "ar"),
  toolRow("تحميل-فيديو-ثريدز", [], "ar"),
  toolRow("threads-video-downloader-hd"),
  toolRow("threads-video-downloader-web-utility"),
  toolRow("threads-to-mp4-video-conversion-tool"),
];
const GUIDES = [
  guideRow("threads-to-mp3-audio-conversion-tutorial", MP3_BODY, [
    "threads-to-mp3-browser-tool",
    "threads-video-to-mp3-audio-extraction-guide",
    "threads-to-mp4-video-conversion-tool",
    "threads-video-downloader-web-utility",
  ]),
  guideRow("how-to-download-threads-videos-on-android", ANDROID_BODY, [
    "threads-video-downloader-hd",
    "threads-carousel-downloader",
    "تنزيل-مقاطع-ثريدز",
    "how-to-download-threads-videos-in-hd-complete-guide",
  ]),
  guideRow("how-to-download-threads-videos-on-pc-browser", PC_BODY, [
    "تحميل-فيديو-ثريدز",
    "threads-video-downloader-hd",
    "threads-carousel-downloader",
    "how-to-download-threads-videos-in-hd-complete-guide",
  ]),
  guideRow("how-to-download-threads-videos-in-hd-complete-guide", "<p>retired</p>"),
  guideRow("blog-save-threads-video-workflow", "<p>retired</p>"),
];

function env() {
  return {
    DB_PROVIDER: "d1",
    ADMIN_DB: fakeD1(TOOLS, GUIDES),
    ASSETS: { fetch: async () => new Response("<!doctype html><html><body><div id=\"root\"></div></body></html>") },
  } as never;
}

const get = (path: string) => new Request(`https://www.test.local${path}`);

describe("rendered DB pages have no broken or retired internal links", () => {
  const pages = [
    "/threads-to-mp3-browser-tool",
    "/blog/threads-to-mp3-audio-conversion-tutorial",
    "/blog/how-to-download-threads-videos-on-android",
    "/blog/how-to-download-threads-videos-on-pc-browser",
  ];

  for (const path of pages) {
    it(`${path} links only to live pages with balanced anchors`, async () => {
      const res = await handlePublicContent(get(path), env(), path);
      expect(res).not.toBe(null);
      expect(res!.status).toBe(200);
      const html = await res!.text();

      // 1) No internal link to a retired (301) or gone (410) page.
      const paths = internalPaths(html);
      const offenders = paths.filter((p) => RETIRED_PATHS.has(p));
      expect(offenders, `retired links on ${path}`).toEqual([]);

      // 2) No internal link built with the wrong prefix (tool under /blog or
      //    guide at the root) — the exact 404 shape reported by the audit.
      expect(paths).not.toContain("/blog/threads-to-mp3-browser-tool");
      expect(paths).not.toContain("/threads-to-mp3-audio-conversion-tutorial");
      expect(paths).not.toContain("/blog/threads-carousel-downloader");

      // 3) Anchors are balanced, never nested, and no pseudo-closer survives
      //    in the article body (the footer `<a href="/">` is a real link).
      expect(anchorOpens(html)).toBe(anchorCloses(html));
      expect(hasNestedAnchor(html)).toBe(false);
      const main = html.match(/<main>([\s\S]*?)<\/main>/)?.[1] ?? "";
      // The only remaining `<a href="/">` inside the page body is the trail
      // link; every pseudo-closer has been converted to `</a>`.
      expect((main.match(/<a href="\/">/g) || []).length).toBe(1);
    });
  }
});

describe("/blog hub never links a retired guide", () => {
  it("lists live guides only", async () => {
    const res = await handleStaticSeo(get("/blog"), env(), "/blog");
    expect(res).not.toBe(null);
    const html = await res!.text();
    expect(html).toContain('href="/blog/how-to-download-threads-videos-on-android"');
    expect(html).toContain('href="/blog/threads-to-mp3-audio-conversion-tutorial"');
    expect(html).not.toContain("/blog/blog-save-threads-video-workflow");
    expect(html).not.toContain("/blog/how-to-download-threads-videos-in-hd-complete-guide");
  });
});
