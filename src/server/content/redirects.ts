/**
 * Content consolidation map: retired DB pages → their canonical destination.
 *
 * Why this exists
 * ---------------
 * The admin content engine created 42 tool pages and guides in the first week
 * of the site. Most were keyword permutations of the same three products
 * (`/threads-video-downloader-hd`, `/threads-video-downloader-free-browser-utility`,
 * `/threads-mp4-downloader-tool`, …), several promised behaviour the tool does
 * not have (`…-unlimited…`, `…-without-watermark…`, `…-length-limit…`,
 * `threads-to-mp4-video-conversion-tool`), and the one non-Threads page
 * (`how-to-download-instagram-reels-web-tool`) promised a platform the resolver
 * rejects. Together they produced ~250 impressions in 40 days while diluting
 * every signal on a brand-new domain.
 *
 * The rows stay in the database (nothing is deleted), but:
 * - each retired slug answers 301 to the page that actually serves the intent;
 * - retired slugs are dropped from the sitemap, from `/api/content/tools` and
 *   from `/api/content/guides`, so neither the Worker sitemap nor the
 *   build-time `scripts/gen-static-seo.mjs` copy can re-introduce them;
 * - `GONE_PATHS` answers 410: that page promised a feature that does not exist,
 *   so there is no honest target to consolidate it into.
 *
 * Re-enabling a page later means deleting its line here — the DB row is intact.
 */

/** Root-level DB tool slugs that must redirect. */
export const RETIRED_TOOL_SLUGS: Readonly<Record<string, string>> = {
  // HD / quality permutations of the same video tool.
  "threads-video-downloader-hd": "/threads-video-downloader",
  "download-threads-video-in-1080p": "/threads-video-downloader",
  // "free / no login / by link / browser utility / reels" permutations.
  "threads-video-downloader-free-browser-utility": "/threads-video-downloader",
  "threads-video-downloader-no-login": "/threads-video-downloader",
  "threads-video-downloader-web-utility": "/threads-video-downloader",
  "threads-video-save-browser-tool": "/threads-video-downloader",
  "download-threads-video-by-link-utility": "/threads-video-downloader",
  "save-threads-reels-video-tool": "/threads-video-downloader",
  "threads-video-downloader-for-pc": "/threads-video-downloader",
  // Claims the tool cannot keep: no unlimited tier, no conversion, no
  // watermark removal, no "length limit" feature.
  "threads-video-downloader-unlimited-access-utility": "/threads-video-downloader",
  "threads-video-download-without-watermark-tool": "/threads-video-downloader",
  "threads-to-mp4-video-conversion-tool": "/threads-video-downloader",
  "threads-mp4-downloader-tool": "/threads-video-downloader",
  "threads-video-length-limit-utility": "/threads-video-downloader",
  // A "best X" listicle with nothing to compare.
  "best-threads-video-downloader-online": "/",
  // The same iPhone how-to, generated twice; the built-in guide owns the intent.
  "how-to-download-threads-video-on-iphone-mobile-browser": "/how-to-download-threads-videos",
  "how-to-download-threads-video-on-iphone-mobile-browser-2": "/how-to-download-threads-videos",
};

/** Blog-level (guide) slugs that must redirect. */
export const RETIRED_GUIDE_SLUGS: Readonly<Record<string, string>> = {
  // "Save threads video" workflows — the tool page is the answer.
  "blog-save-threads-video-workflow": "/threads-video-downloader",
  "blog-threads-video-save-complete-workflow": "/threads-video-downloader",
  // Onboarding guides — /how-to-use is the walkthrough.
  "blog-mastering-threads-video-downloader-usage": "/how-to-use",
  "threads-video-downloader-online-without-registration-guide": "/how-to-use",
  // Guides that duplicate a tool page exactly.
  "blog-download-threads-carousel-images-guide": "/threads-carousel-downloader",
  "blog-threads-photo-downloader-tutorial": "/threads-photo-downloader",
  // Claims that do not match the implementation.
  "threads-to-mp4-conversion-guide": "/threads-video-downloader",
  "how-to-download-threads-videos-in-hd-complete-guide": "/threads-video-downloader",
  "threads-gif-downloader-guide": "/threads-video-downloader",
  "threads-video-download-without-watermark-guide": "/threads-video-downloader",
  // Third MP3 page of three, compacted into the surviving one.
  "blog-extract-audio-from-threads-video": "/blog/threads-to-mp3-audio-conversion-tutorial",
  "threads-video-to-mp3-audio-extraction-guide": "/blog/threads-to-mp3-audio-conversion-tutorial",
  // Duplicate device guides.
  "how-to-download-threads-videos-desktop": "/blog/how-to-download-threads-videos-on-pc-browser",
  "download-threads-videos-on-iphone-guide": "/blog/how-to-download-threads-videos-on-iphone-safari-ios",
  "download-threads-videos-without-an-app": "/how-to-download-threads-videos",
};

/** Pages that are removed on purpose (410): no honest destination exists. */
export const GONE_PATHS: readonly string[] = ["/how-to-download-instagram-reels-web-tool"];

function lookup(map: Readonly<Record<string, string>>, key: string): string | null {
  const target = map[key];
  return typeof target === "string" ? target : null;
}

/** Strip trailing slashes so `/slug/` matches the same rule as `/slug`. */
function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isRetiredToolSlug(slug: string): boolean {
  return lookup(RETIRED_TOOL_SLUGS, slug) !== null;
}

export function isRetiredGuideSlug(slug: string): boolean {
  return lookup(RETIRED_GUIDE_SLUGS, slug) !== null;
}

/**
 * Canonical destination for a retired path, or null. Only root-level tool
 * slugs and one-level `/blog/<slug>` guides are considered, so unrelated
 * routes and nested paths are never touched.
 */
export function retiredRedirect(pathname: string): string | null {
  const path = normalise(pathname);
  if (path === "/" || path.startsWith("/api/") || path.startsWith("/admin")) return null;
  if (path.startsWith("/blog/")) {
    const rest = path.slice("/blog/".length);
    if (rest.length === 0 || rest.includes("/")) return null;
    return lookup(RETIRED_GUIDE_SLUGS, rest);
  }
  const slug = path.slice(1);
  if (slug.length === 0 || slug.includes("/")) return null;
  return lookup(RETIRED_TOOL_SLUGS, slug);
}

/** True when the path is intentionally removed (HTTP 410). */
export function isGonePath(pathname: string): boolean {
  return GONE_PATHS.includes(normalise(pathname));
}
