import { describe, it, expect } from "vitest";
import {
  GONE_PATHS,
  RETIRED_GUIDE_SLUGS,
  RETIRED_TOOL_SLUGS,
  isGonePath,
  isRetiredGuideSlug,
  isRetiredToolSlug,
  retiredRedirect,
} from "../src/server/content/redirects";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { isIndexableDbSlug } from "../src/server/worker";
import type { D1Binding } from "../src/server/db/d1";

const allTargets = [...Object.values(RETIRED_TOOL_SLUGS), ...Object.values(RETIRED_GUIDE_SLUGS)];

describe("content consolidation map", () => {
  it("never redirects to a retired slug, a gone page or itself", () => {
    for (const [slug, target] of Object.entries(RETIRED_TOOL_SLUGS)) {
      expect(target.startsWith("/"), `${slug} target`).toBe(true);
      expect(isRetiredToolSlug(target.replace(/^\//, "")), `${slug} → retired tool`).toBe(false);
      expect(isGonePath(target), `${slug} → gone page`).toBe(false);
      expect(target).not.toBe(`/${slug}`);
    }
    for (const [slug, target] of Object.entries(RETIRED_GUIDE_SLUGS)) {
      expect(target.startsWith("/"), `${slug} target`).toBe(true);
      expect(isRetiredGuideSlug(target.replace(/^\/blog\//, "")), `${slug} → retired guide`).toBe(false);
      expect(isGonePath(target), `${slug} → gone page`).toBe(false);
      expect(target).not.toBe(`/blog/${slug}`);
    }
  });

  it("targets real destinations (a built-in route or a live-only guide)", () => {
    const staticPaths = new Set(SEO_ROUTES.map((r) => r.path));
    for (const target of allTargets) {
      const known = staticPaths.has(target) || target.startsWith("/blog/");
      expect(known, `unresolvable target: ${target}`).toBe(true);
    }
  });

  it("keeps the three flagship tool routes out of the retired set", () => {
    for (const path of ["/threads-video-downloader", "/threads-photo-downloader", "/threads-carousel-downloader"]) {
      expect(isRetiredToolSlug(path.slice(1))).toBe(false);
      expect(retiredRedirect(path)).toBe(null);
    }
  });
});

describe("retiredRedirect", () => {
  it("301s a retired tool slug to the page that owns the intent", () => {
    expect(retiredRedirect("/threads-video-downloader-hd")).toBe("/threads-video-downloader");
    expect(retiredRedirect("/threads-video-downloader-hd/")).toBe("/threads-video-downloader");
    expect(retiredRedirect("/best-threads-video-downloader-online")).toBe("/");
  });

  it("301s a retired guide to its replacement", () => {
    expect(retiredRedirect("/blog/blog-save-threads-video-workflow")).toBe("/threads-video-downloader");
    expect(
      retiredRedirect("/blog/how-to-download-threads-videos-desktop"),
    ).toBe("/blog/how-to-download-threads-videos-on-pc-browser");
  });

  it("leaves live pages, API routes, admin and nested paths alone", () => {
    for (const path of [
      "/",
      "/faq",
      "/threads-video-downloader",
      "/threads-to-mp3-browser-tool",
      "/blog",
      "/blog/threads-to-mp3-audio-conversion-tutorial",
      "/api/resolve",
      "/api/content/tools",
      "/admin/content",
      "/threads-video-downloader-hd/extra",
      "/unknown-page",
    ]) {
      expect(retiredRedirect(path), path).toBe(null);
    }
  });

  it("matches the Arabic slugs exactly and never by prefix", () => {
    expect(retiredRedirect("/threads-video-downloader-h")).toBe(null);
    expect(retiredRedirect("/تحميل-فيديو-ثريدز")).toBe(null);
  });

  it("flags intentionally removed pages", () => {
    expect(GONE_PATHS.length).toBeGreaterThan(0);
    for (const p of GONE_PATHS) {
      expect(isGonePath(p)).toBe(true);
      expect(retiredRedirect(p), "gone pages have no redirect target").toBe(null);
    }
  });
});

describe("sitemap eligibility", () => {
  it("drops retired slugs and route-shadowed rows", () => {
    expect(isIndexableDbSlug("tool", "threads-video-downloader-hd")).toBe(false);
    expect(isIndexableDbSlug("guide", "blog-save-threads-video-workflow")).toBe(false);
    expect(isIndexableDbSlug("tool", "threads-photo-downloader")).toBe(false); // static route wins
    expect(isIndexableDbSlug("tool", "threads-to-mp3-browser-tool")).toBe(true);
    expect(isIndexableDbSlug("guide", "threads-to-mp3-audio-conversion-tutorial")).toBe(true);
  });
});

/** Minimal D1 stub: only the two slug queries the sitemap needs. */
function fakeDb(tools: string[], guides: string[]): D1Binding {
  const toRows = (slugs: string[]) => slugs.map((slug) => ({ slug, updated_at: "2026-10-06T00:00:00Z" }));
  return {
    prepare(query: string) {
      return {
        bind() {
          return {
            run: async () => ({}),
            first: async () => null,
            all: async () => ({
              results: query.includes("from tool_pages") ? toRows(tools) : toRows(guides),
            }),
          };
        },
      };
    },
    batch: async () => [],
  } as unknown as D1Binding;
}

function envWith(tools: string[], guides: string[]) {
  return {
    DB_PROVIDER: "d1",
    ADMIN_DB: fakeDb(tools, guides),
    ASSETS: {
      fetch: async () =>
        new Response('<!doctype html><html lang="en"><head><title>x</title></head><body><div id="root"></div></body></html>'),
    },
  } as never;
}

describe("worker content consolidation", () => {
  it("301s retired pages before any renderer runs", async () => {
    const { default: worker } = await import("../src/server/worker");
    const res = await worker.fetch(new Request("https://test.local/threads-video-downloader-hd"), envWith([], []));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://test.local/threads-video-downloader");
    expect(res.headers.get("cache-control")).toContain("max-age=");
  });

  it("answers 410 for pages that promised a feature that does not exist", async () => {
    const { default: worker } = await import("../src/server/worker");
    const res = await worker.fetch(new Request(`https://test.local${GONE_PATHS[0]}`), envWith([], []));
    expect(res.status).toBe(410);
    const html = await res.text();
    expect(html).toContain("Page removed");
    expect(html).toContain("noindex");
  });

  it("never 301s a non-idempotent request (POST must not become GET)", async () => {
    const { default: worker } = await import("../src/server/worker");
    const res = await worker.fetch(
      new Request("https://test.local/threads-video-downloader-hd", { method: "POST" }),
      envWith([], []),
    );
    expect(res.status).not.toBe(301);
  });

  it("keeps retired and route-shadowed slugs out of the sitemap", async () => {
    const { default: worker } = await import("../src/server/worker");
    const res = await worker.fetch(
      new Request("https://test.local/sitemap.xml"),
      envWith(["threads-to-mp3-browser-tool", "threads-video-downloader-hd", "threads-photo-downloader"], [
        "threads-to-mp3-audio-conversion-tutorial",
        "blog-save-threads-video-workflow",
      ]),
    );
    const xml = await res.text();
    expect(xml).toContain("/threads-to-mp3-browser-tool");
    expect(xml).toContain("/blog/threads-to-mp3-audio-conversion-tutorial");
    expect(xml).not.toContain("/threads-video-downloader-hd");
    expect(xml).not.toContain("/blog/blog-save-threads-video-workflow");
    // Exactly one entry for a URL whose slug is also a built-in route.
    expect((xml.match(/<loc>[^<]*\/threads-photo-downloader<\/loc>/g) || []).length).toBe(1);
  });
});
