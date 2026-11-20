import type { SeoRoute } from "../types";
import { LOCALIZED_HOMES } from "./localized-home";

/** Content date for the localized homepages (bumped when their copy changes). */
const LOCALIZED_UPDATED = "2026-11-20";

/**
 * Single source of truth for every indexable static page.
 *
 * `updated` feeds `<lastmod>` in the Worker sitemap and in the build-time copy.
 * It is a curated content date, not a build/deploy timestamp: rebuilding the
 * site does not change a page, so stamping the build time would be a fake
 * freshness signal. Bump a route's date only when its visible copy or markup
 * changes (the sitemap test rejects future dates and malformed values).
 */
export const SEO_ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: "Threads Video Downloader - Download Videos & Photos Free",
    description:
      "Download public Threads videos, photos and carousel media in MP4 or JPG. Free, no login, no app — works on iPhone, Android and desktop.",
    h1: "Download Threads Videos & Photos",
    updated: "2026-11-20",
  },
  // Localized homepages are part of the indexable registry so the sitemap,
  // canonicals and the router all see them. Their copy lives in
  // src/lib/localized-home.ts; deriving the entry here keeps the two copies
  // from drifting.
  ...LOCALIZED_HOMES.map((p) => ({
    path: p.path,
    title: p.title,
    description: p.description,
    h1: p.h1,
    updated: LOCALIZED_UPDATED,
  })),
  {
    path: "/threads-video-downloader",
    title: "Threads Video Downloader - Save MP4 in HD, No Login",
    description:
      "Paste a public Threads video link and save the MP4 the post publishes — 1080p, 720p or a single SD file. Preview, real quality labels and MP3 audio.",
    h1: "Threads Video Downloader",
    updated: "2026-11-20",
    summary:
      "Paste a public Threads video link above. The tool lists every MP4 rendition the post actually publishes — 1080p, 720p, 480p or the single file it has — with a preview, the resolution and the duration when the source provides them. Nothing is invented: if a post offers one file, you see one download button.",
  },
  {
    path: "/threads-photo-downloader",
    title: "Threads Photo Downloader - Save Public Photos as JPG",
    description:
      "Save public Threads photos with their real dimensions and format. Paste a post link, preview every image and download the ones you need.",
    h1: "Threads Photo Downloader",
    updated: "2026-11-20",
    summary:
      "Paste a public Threads post link above. Each detected photo appears with a preview, its pixel dimensions and its format, plus an individual download button. Multi-image posts are handled as carousels, so you can keep the images you need instead of guessing which file is which.",
  },
  {
    path: "/threads-carousel-downloader",
    title: "Threads Carousel Downloader - Save Every Slide",
    description:
      "Detect every image and video in a public Threads carousel post, preview each slide and download them one by one — no ZIP, no waiting.",
    h1: "Threads Carousel Downloader",
    updated: "2026-11-20",
    summary:
      "Paste the link of a public carousel post above. Every slide is listed on its own — photo or video, with its preview and details — and Download All saves them one after another. There is deliberately no ZIP export: building archives server-side would mean holding large files in memory, so the tool offers fast individual downloads instead.",
  },
  {
    path: "/how-to-download-threads-videos",
    title: "How to Download Threads Videos - 3 Simple Steps",
    description:
      "Copy a public Threads link, paste it into the downloader and save the available media. Works on iPhone, Android and desktop.",
    h1: "How to Download Threads Videos",
    updated: "2026-10-27",
  },
  {
    path: "/how-to-use",
    title: "How to Use the Threads Downloader - Step by Step",
    description:
      "Full walkthrough: find a public Threads post, copy the link, paste it, review the detected media and save it. Includes fixes for the most common errors.",
    h1: "How to Use the Threads Downloader",
    updated: "2026-10-27",
  },
  {
    path: "/about",
    title: "About SaveThreadsVideos - Independent Threads Downloader",
    description:
      "Who runs this free Threads media downloader, what it does with a public post link, and how it approaches privacy, copyright and errors. Independent, no login.",
    h1: "About SaveThreadsVideos",
    updated: "2026-10-27",
  },
  {
    path: "/faq",
    title: "FAQ - Threads Video Downloader",
    description:
      "Answers about downloading public Threads videos and photos: supported links, quality, privacy and troubleshooting.",
    h1: "Frequently Asked Questions",
    updated: "2026-10-27",
  },
  {
    path: "/privacy",
    title: "Privacy Policy - Threads Video Downloader",
    description:
      "What this downloader collects and why: hashed request logs, Google Analytics, contact form data, local storage and the advertising status. Effective date included.",
    h1: "Privacy Policy",
    updated: "2026-10-27",
  },
  {
    path: "/terms",
    title: "Terms of Use - Threads Video Downloader",
    description:
      "Rules for using this free Threads downloader: public content only, respect copyright and permissions, no automated abuse, and the limits of the service.",
    h1: "Terms of Use",
    updated: "2026-10-27",
  },
  {
    path: "/disclaimer",
    title: "Disclaimer - Independent Threads Downloader",
    description:
      "This tool is not affiliated with Threads, Instagram or Meta. Trademarks belong to their owners and you are responsible for how you reuse downloaded media.",
    h1: "Disclaimer",
    updated: "2026-10-27",
  },
  {
    path: "/contact",
    title: "Contact - Threads Video Downloader",
    description:
      "Report a post that will not resolve, a site error, an accessibility problem, or a copyright and privacy concern. Includes the form's privacy notice.",
    h1: "Contact Us",
    updated: "2026-11-20",
  },
  {
    path: "/blog",
    title: "Blog - Threads Video Downloader Guides",
    description: "Guides for saving public Threads media responsibly on any device.",
    h1: "Blog",
    updated: "2026-11-20",
  },
];

export function routeFor(path: string): SeoRoute {
  return SEO_ROUTES.find((r) => r.path === path) ?? SEO_ROUTES[0];
}

/**
 * Sibling links shared by the three product pages. Counting on site-wide
 * navigation alone left the tool pages linked only from the header/footer,
 * while the homepage held almost all of the site's search visibility — so the
 * product pages now link to each other and to the how-to guide explicitly.
 */
export const TOOL_SIBLINGS: { path: string; label: string }[] = [
  { path: "/threads-video-downloader", label: "Threads Video Downloader" },
  { path: "/threads-photo-downloader", label: "Threads Photo Downloader" },
  { path: "/threads-carousel-downloader", label: "Threads Carousel Downloader" },
  { path: "/how-to-download-threads-videos", label: "How to download Threads videos" },
  { path: "/faq", label: "Frequently asked questions" },
];

/** Every sibling except the current page. */
export function siblingsFor(path: string): { path: string; label: string }[] {
  return TOOL_SIBLINGS.filter((l) => l.path !== path);
}
