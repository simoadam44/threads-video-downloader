import type { SeoRoute } from "../types";

export const SEO_ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: "Threads Video Downloader - Download Threads Videos & Photos",
    description:
      "Download public Threads videos, photos and carousel media in high quality. Fast, free and easy to use with no login required.",
    h1: "Download Threads Videos",
  },
  {
    path: "/threads-video-downloader",
    title: "Threads Video Downloader - Save Public Threads Videos in HD",
    description:
      "Paste a public Threads video link and save the available MP4 in the best published quality. No login, no software.",
    h1: "Threads Video Downloader",
  },
  {
    path: "/threads-photo-downloader",
    title: "Threads Photo Downloader - Save Public Threads Photos",
    description:
      "Save public Threads photos with preview, resolution and format info. Paste a link and download individual images.",
    h1: "Threads Photo Downloader",
  },
  {
    path: "/threads-carousel-downloader",
    title: "Threads Carousel Downloader - Save All Carousel Media",
    description:
      "Detect every image and video in a public Threads carousel post, preview each item and download them one by one.",
    h1: "Threads Carousel Downloader",
  },
  {
    path: "/how-to-download-threads-videos",
    title: "How to Download Threads Videos - 3 Simple Steps",
    description:
      "Copy a public Threads link, paste it into the downloader and save the available media. Works on iPhone, Android and desktop.",
    h1: "How to Download Threads Videos",
  },
  {
    path: "/faq",
    title: "FAQ - Threads Video Downloader",
    description:
      "Answers about downloading public Threads videos and photos: supported links, quality, privacy and troubleshooting.",
    h1: "Frequently Asked Questions",
  },
  {
    path: "/privacy",
    title: "Privacy Policy - Threads Video Downloader",
    description: "How this independent tool handles links, media and analytics. Public content only, no login required.",
    h1: "Privacy Policy",
  },
  {
    path: "/terms",
    title: "Terms of Use - Threads Video Downloader",
    description:
      "Acceptable use for this independent third-party tool: public content only, respect copyright and permissions.",
    h1: "Terms of Use",
  },
  {
    path: "/contact",
    title: "Contact - Threads Video Downloader",
    description: "Contact the operator of this independent Threads downloader tool, including copyright concerns.",
    h1: "Contact",
  },
  {
    path: "/blog",
    title: "Blog - Threads Video Downloader Guides",
    description: "Guides for saving public Threads media responsibly on any device.",
    h1: "Blog",
  },
];

export function routeFor(path: string): SeoRoute {
  return SEO_ROUTES.find((r) => r.path === path) ?? SEO_ROUTES[0];
}
