import { describe, it, expect } from "vitest";
import { handlePublicContent } from "../src/server/worker";
import type { D1Binding } from "../src/server/db/d1";

/** Minimal in-memory D1 stub supporting the content queries. */
function fakeD1(): D1Binding & { tables: { tool_pages: Record<string, unknown>[]; guides: Record<string, unknown>[] } } {
  const tables: { tool_pages: Record<string, unknown>[]; guides: Record<string, unknown>[] } = {
    tool_pages: [
      {
        id: 1, slug: "threads-video-downloader-hd", badge: "HD", lang: "en",
        target_keyword: "Threads Video Downloader",
        title: "Threads Video Downloader HD - Save Public Threads Videos in High Quality for Free",
        description: "Paste a public Threads video link and save the available MP4 in the best published quality. Fast, free, no login required for everyone.",
        h1: "Threads Video Downloader HD", intro: "x".repeat(120),
        faqs: JSON.stringify([{ q: "How do I download a video here?", a: "Copy the public link, paste it above, and press download to save the file." }]),
        related_slugs: JSON.stringify([]), status: "live",
      },
    ],
    guides: [
      {
        id: 1, slug: "how-to-download-threads-videos-on-android", lang: "en",
        target_keyword: "How to Download Threads Videos on Android",
        title: "How to Download Threads Videos on Android - Save to Gallery in Three Easy Steps",
        description: "Learn how to download public Threads videos on Android and save them straight to your gallery with no app or login needed at all.",
        h1: "How to Download Threads Videos on Android", body: "<p>" + "y".repeat(900) + "</p>",
        faqs: JSON.stringify([{ q: "Where do videos save on Android?", a: "In your Downloads folder and Gallery app automatically after saving." }]),
        related_slugs: JSON.stringify(["threads-video-downloader-hd"]), status: "live",
      },
      {
        id: 2, slug: "unpublished-draft-guide", lang: "en",
        target_keyword: "Draft That Must Stay Hidden",
        title: "Draft Guide That Must Never Appear Anywhere Public",
        description: "A draft description that must never leak into any public list, hub, or sitemap for any reason at all.",
        h1: "Draft Guide", body: "<p>" + "z".repeat(900) + "</p>",
        faqs: JSON.stringify([]), related_slugs: JSON.stringify([]), status: "draft",
      },
    ],
  };
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
    tables,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            run: async () => ({}),
            first: async <T,>() => {
              const rows = parse(query, values);
              return (rows[0] ?? null) as T | null;
            },
            all: async <T,>() => ({ results: parse(query, values) as T[] }),
          };
        },
      };
    },
    batch: async () => [],
  };
}

const TEMPLATE = `<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="old" /><link rel="canonical" href="/" /></head><body><div id="root"></div></body></html>`;

function env() {
  return {
    DB_PROVIDER: "d1",
    ADMIN_DB: fakeD1(),
    ASSETS: { fetch: async () => new Response(TEMPLATE, { status: 200 }) },
  } as never;
}

const get = (path: string) => new Request(`https://test.local${path}`);

describe("server-rendered SEO pages", () => {
  it("renders a live tool page with unique meta + schemas + related links", async () => {
    const res = await handlePublicContent(get("/threads-video-downloader-hd"), env(), "/threads-video-downloader-hd");
    expect(res).not.toBe(null);
    const html = await res!.text();
    expect(res!.status).toBe(200);
    expect(html).toContain("<h1>Threads Video Downloader HD</h1>");
    expect(html).toContain("<title>Threads Video Downloader HD - Save Public Threads Videos");
    expect(html).toContain('rel="canonical" href="https://test.local/threads-video-downloader-hd"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"@type":"FAQPage"');
  });
  it("renders a live guide with Article schema + RTL only for Arabic", async () => {
    const res = await handlePublicContent(get("/blog/how-to-download-threads-videos-on-android"), env(), "/blog/how-to-download-threads-videos-on-android");
    expect(res).not.toBe(null);
    const html = await res!.text();
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain("<h1>How to Download Threads Videos on Android</h1>");
    expect(html).toContain("/threads-video-downloader-hd"); // cross-link
  });
  it("unknown slugs fall through (null) and reserved slugs never render", async () => {
    expect(await handlePublicContent(get("/nope"), env(), "/nope")).toBe(null);
    expect(await handlePublicContent(get("/faq"), env(), "/faq")).toBe(null);
    expect(await handlePublicContent(get("/admin"), env(), "/admin")).toBe(null);
  });
  it("sitemap includes only live DB slugs plus static routes", async () => {
    const { default: worker } = await import("../src/server/worker");
    const res = await worker.fetch(get("/sitemap.xml"), env());
    const xml = await res.text();
    expect(xml).toContain("/threads-video-downloader-hd");
    expect(xml).toContain("/blog/how-to-download-threads-videos-on-android");
    expect(xml).not.toContain("/api/");
  });
});

describe("blog hub lists live guides", () => {
  it("GET /api/content/guides returns live guides with light public fields only", async () => {
    const res = await handlePublicContent(get("/api/content/guides"), env(), "/api/content/guides");
    expect(res).not.toBe(null);
    expect(res!.status).toBe(200);
    const json = (await res!.json()) as { success: boolean; data: Record<string, unknown>[] };
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0]).toEqual({
      slug: "how-to-download-threads-videos-on-android",
      title: "How to Download Threads Videos on Android - Save to Gallery in Three Easy Steps",
      description: "Learn how to download public Threads videos on Android and save them straight to your gallery with no app or login needed at all.",
      lang: "en",
      updated_at: "",
    });
    // Drafts and heavy/private fields never leak into the public index.
    expect(JSON.stringify(json)).not.toContain("unpublished-draft-guide");
    expect(JSON.stringify(json)).not.toContain("Draft Guide That Must Never Appear");
  });
  it("GET /api/content/tools returns live tool pages with light public fields", async () => {
    const res = await handlePublicContent(get("/api/content/tools"), env(), "/api/content/tools");
    expect(res).not.toBe(null);
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("application/json");
    const json = (await res!.json()) as { success: boolean; data: Record<string, unknown>[] };
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(Object.keys(json.data[0]).sort()).toEqual(["description", "lang", "slug", "title", "updated_at"]);
    expect(json.data[0]["slug"]).toBe("threads-video-downloader-hd");
  });
  it("SSR /blog hub links every live guide (crawlable without JS)", async () => {
    const { handleStaticSeo } = await import("../src/server/worker");
    const res = await handleStaticSeo(get("/blog"), env(), "/blog");
    expect(res).not.toBe(null);
    const html = await res!.text();
    expect(res!.status).toBe(200);
    expect(html).toContain('href="/blog/how-to-download-threads-videos-on-android"');
    expect(html).not.toContain("unpublished-draft-guide");
  });
  it("other static routes render no guides nav", async () => {
    const { handleStaticSeo } = await import("../src/server/worker");
    const res = await handleStaticSeo(get("/faq"), env(), "/faq");
    const html = await res!.text();
    expect(html).not.toContain("Latest guides");
  });
  it("guide titles in the hub are HTML-escaped (no XSS via admin input)", async () => {
    const { renderStaticRoute } = await import("../src/server/content/render");
    const { SEO_ROUTES } = await import("../src/lib/seo-routes");
    const route = SEO_ROUTES.find((r) => r.path === "/blog")!;
    const html = renderStaticRoute(null, "https://test.local", "/og-image.svg", route, undefined, undefined, [
      { slug: "xss-probe", title: '"><script>alert(1)</script>' },
    ]);
    expect(html).toContain('href="/blog/xss-probe"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
