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
    summary:
      "Paste a public Threads video link above. The tool lists every MP4 rendition the post actually publishes — 1080p, 720p, 480p or the single file it has — with a preview, the resolution and the duration when the source provides them. Nothing is invented: if a post offers one file, you see one download button.",
  },
  {
    path: "/threads-photo-downloader",
    title: "Threads Photo Downloader - Save Public Threads Photos",
    description:
      "Save public Threads photos with preview, resolution and format info. Paste a link and download individual images.",
    h1: "Threads Photo Downloader",
    summary:
      "Paste a public Threads post link above. Each detected photo appears with a preview, its pixel dimensions and its format, plus an individual download button. Multi-image posts are handled as carousels, so you can keep the images you need instead of guessing which file is which.",
  },
  {
    path: "/threads-carousel-downloader",
    title: "Threads Carousel Downloader - Save All Carousel Media",
    description:
      "Detect every image and video in a public Threads carousel post, preview each item and download them one by one.",
    h1: "Threads Carousel Downloader",
    summary:
      "Paste the link of a public carousel post above. Every slide is listed on its own — photo or video, with its preview and details — and Download All saves them one after another. There is deliberately no ZIP export: building archives server-side would mean holding large files in memory, so the tool offers fast individual downloads instead.",
  },
  {
    path: "/how-to-download-threads-videos",
    title: "How to Download Threads Videos - 3 Simple Steps",
    description:
      "Copy a public Threads link, paste it into the downloader and save the available media. Works on iPhone, Android and desktop.",
    h1: "How to Download Threads Videos",
  },
  {
    path: "/how-to-use",
    title: "How to Use the Threads Downloader - Step by Step",
    description:
      "Full walkthrough: find a public Threads post, copy the link, paste it, review the detected media and save it. Includes fixes for the most common errors.",
    h1: "How to Use the Threads Downloader",
  },
  {
    path: "/about",
    title: "About SaveThreadsVideos - Independent Threads Downloader",
    description:
      "Who runs this free Threads media downloader, what it does with a public post link, and how it approaches privacy, copyright and errors. Independent, no login.",
    h1: "About SaveThreadsVideos",
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
    description:
      "What this downloader collects and why: hashed request logs, Google Analytics, contact form data, local storage and the advertising status. Effective date included.",
    h1: "Privacy Policy",
  },
  {
    path: "/terms",
    title: "Terms of Use - Threads Video Downloader",
    description:
      "Rules for using this free Threads downloader: public content only, respect copyright and permissions, no automated abuse, and the limits of the service.",
    h1: "Terms of Use",
  },
  {
    path: "/disclaimer",
    title: "Disclaimer - Independent Threads Downloader",
    description:
      "This tool is not affiliated with Threads, Instagram or Meta. Trademarks belong to their owners and you are responsible for how you reuse downloaded media.",
    h1: "Disclaimer",
  },
  {
    path: "/contact",
    title: "Contact - Threads Video Downloader",
    description:
      "Report a post that will not resolve, a site error, an accessibility problem, or a copyright and privacy concern. Includes the form's privacy notice.",
    h1: "Contact Us",
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
