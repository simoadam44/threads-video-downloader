/**
 * Homepage body copy — the long-form text behind the downloader form.
 *
 * Why this module exists:
 * - The homepage carried ~97% of the site's search impressions while its
 *   server-rendered HTML was 33 words with no `<h2>`, no FAQ and a `WebSite`
 *   schema only. A page that ranks on title match alone has nothing to defend
 *   its position when search systems re-evaluate quality.
 * - The same blocks are consumed by the Worker (`src/server/content/render.ts`)
 *   and by React (`src/pages/pages.tsx`), so the crawlable HTML and the visible
 *   page cannot drift.
 *
 * Content rules (same bar as `src/lib/tool-content.ts`, enforced by tests):
 * - describe only behaviour that exists in this repository;
 * - never promise a quality, size, duration or device capability the source
 *   may not provide;
 * - no "unlimited", "best", "guaranteed", "fastest", "watermark-free" or
 *   "without watermark" claims — the tool leaves files as they were published;
 * - no invented statistics, ratings, user counts or testimonials;
 * - the homepage FAQ is deliberately not a copy of `src/lib/faq.ts`, so `/`
 *   and `/faq` do not ship the same question-and-answer block twice.
 */

import type { ToolFaq, ToolSection } from "./tool-content";

/** Crawlable internal links, rendered as cards under the FAQ. */
export interface HomeLink {
  href: string;
  label: string;
  summary: string;
}

export const HOME_SECTIONS: ToolSection[] = [
  {
    h2: "Save public Threads videos, photos and carousels",
    body: [
      "Paste a link to a public Threads post and this page lists every media file that post publishes: the video files, the photos, and each slide of a carousel. You review what was found, then save the file you need. There is no account to create, nothing to install and no browser extension to add.",
      "The tool reads only what a signed-out visitor can see. If a post opens in a private window without logging in, it can be resolved here; if it needs a login, it is out of scope and the page says so instead of returning an empty result.",
    ],
  },
  {
    h2: "Three steps from a link to a saved file",
    body: [
      "Open the post in the Threads app or on the web, use the share icon and copy the link. The address looks like https://www.threads.net/@username/post/ABC123, and the threads.com equivalent works the same way.",
      "Paste it into the box at the top of this page and press Download. The resolver reads the post, the result panel appears with a preview of each item, and every item gets its own save button. Download All walks the list in order when a post holds more than one file.",
    ],
    bullets: [
      "Copy the post link, not the profile link — profile pages are not posts.",
      "Share links of the form /t/… are normalised to the post they point at.",
      "Paste the whole link: a truncated URL cannot be resolved.",
    ],
  },
  {
    h2: "What each result card tells you",
    body: [
      "A card shows a preview, the media type and the item number. When the post reports them, the card also shows the pixel dimensions, the duration for video and the file size. Nothing is filled in from a template: a value the source does not provide is simply left out.",
      "Video items get a player with native controls, so you can check the file before saving it. Photo items show the image itself. Carousel items keep the order they have in the post.",
    ],
  },
  {
    h2: "Quality is whatever the post actually publishes",
    body: [
      "Threads stores a few renditions of many videos. When a post exposes more than one, each rendition becomes its own entry, labelled with its real resolution, so you can pick the one that fits your device and your data plan. When a post exposes a single file, you see a single button.",
      "The tool never upscales, re-encodes or invents a resolution. It also does not report a bitrate, a frame rate or a duration that the source did not send, which is why two different posts can show two different sets of numbers.",
    ],
  },
  {
    h2: "Carousels and photo sets",
    body: [
      "A carousel of five slides becomes five cards, each with its own button, because the files are separate and you may only want one of them. There is deliberately no ZIP export: building an archive would mean holding every file in the Worker's memory at once, and one large video would break the request.",
    ],
  },
  {
    h2: "Save the audio as MP3, decoded in your browser",
    body: [
      "Every video card also has an MP3 button. It downloads the video, decodes its audio track with the Web Audio API and encodes an MP3 locally, so the sound never leaves your device and the server never converts a file. That is why audio extraction needs no queue, no account and no separate upload step.",
      "The browser has to hold the decoded audio in memory, so very long clips can exceed what a phone allows and are refused with a message instead of a broken file. When the creator publishes an audio-only version, that file is a better source than a re-encode.",
    ],
  },
  {
    h2: "When a Threads link does not resolve",
    body: [
      "Four causes cover almost every failure, and each one has a different fix. The result panel names the case it hit instead of failing silently, so you know whether to copy a different link or stop trying.",
    ],
    bullets: [
      "A profile link was copied instead of a post link — open the post itself and copy from there.",
      "Only part of the URL was copied; a post address has to contain /post/ and its identifier.",
      "The post is private, followers-only, deleted or age-restricted, so no signed-out visitor can read it.",
      "The post is public but holds only text, so there is no video, photo or audio file to save.",
    ],
  },
  {
    h2: "What this tool cannot do",
    body: [
      "Private accounts, followers-only posts, deleted posts and age-restricted content cannot be resolved, and no workaround is offered. Profile pages and profile pictures are not posts, so they are rejected as unsupported links. Media from other platforms is outside the scope of a Threads downloader.",
      "The downloader does not remove watermarks and does not alter the file: the bytes you receive are the bytes the public post serves. No watermark is added either.",
    ],
  },
  {
    h2: "Rate limits, expiry and what is stored",
    body: [
      "Link resolution is limited to 20 requests per minute per network, which is far above normal manual use but stops scripts. Post metadata is cached for about five minutes, so resolving the same link twice returns the same result instantly. Save links are short-lived and expire after roughly five minutes; if one expires, resolve the post again and use the fresh buttons.",
      "Media is streamed from the platform's servers to your browser. Nothing is written to disk on our side and no copy of your file is kept. Each resolution is logged with a hashed link and a hashed IP address, plus the outcome, so failures can be counted without storing the link itself.",
    ],
  },
  {
    h2: "Independent, and honest about it",
    body: [
      "This is an independent third-party utility. It is not affiliated with, endorsed by or operated by Threads, Instagram or Meta, and it does not use their logos. Downloading a public file does not transfer rights to it: reuse only content you created, content you have permission to use, or content published under a licence that allows it.",
    ],
  },
];

export const HOME_FAQS: ToolFaq[] = [
  {
    q: "Do I need a Threads account to use this page?",
    a: "No. The downloader never asks for a username, a password, a cookie or an access token. It reads posts the way a signed-out visitor would, so anything that requires a login is simply not available here.",
  },
  {
    q: "Which link should I copy?",
    a: "The link of the post itself, for example https://www.threads.net/@username/post/ABC123. A profile link, a search page or a hashtag page is not a post and is rejected. On a phone, use the share icon inside the post and choose Copy link.",
  },
  {
    q: "Can I download a private or deleted post?",
    a: "No. Private accounts, followers-only posts, deleted posts and age-restricted posts are outside what this tool can read, and it does not attempt to get around access controls. The result panel explains which case it hit.",
  },
  {
    q: "Why do I only see one quality option?",
    a: "Because the post publishes one file. The list is built from the renditions found in the post, so a clip stored only at 720p shows one button and never a 1080p option that does not exist.",
  },
  {
    q: "Does it work on iPhone and Android?",
    a: "Yes, in the mobile browser. On iOS the browser may open the video in its player first; use the share sheet to save it to Files. On Android the saved file goes to the Downloads folder or the gallery, depending on the browser.",
  },
  {
    q: "Do you keep the videos I download?",
    a: "No. Files are streamed straight to your device and are not stored on the server. Only the public metadata of the post is cached for a few minutes, and the request log keeps hashed values instead of the link itself.",
  },
  {
    q: "Is this an official Threads tool?",
    a: "No. It is an independent third-party website with no connection to Threads, Instagram or Meta. Trademarks belong to their owners, and the terms page explains the copyright rules that apply to anything you save.",
  },
];

export const HOME_LINKS: HomeLink[] = [
  {
    href: "/threads-video-downloader",
    label: "Threads Video Downloader",
    summary: "Start here when the post contains a video: available renditions, the MP3 button and mixed carousels.",
  },
  {
    href: "/threads-photo-downloader",
    label: "Threads Photo Downloader",
    summary: "Saving one photo or a whole photo set, with the dimensions and format the post reports.",
  },
  {
    href: "/threads-carousel-downloader",
    label: "Threads Carousel Downloader",
    summary: "How each slide of a carousel is listed, and why there is no ZIP button.",
  },
  {
    href: "/how-to-download-threads-videos",
    label: "How to download Threads videos",
    summary: "The three steps in short form, with fixes for the usual error messages.",
  },
  {
    href: "/faq",
    label: "Frequently asked questions",
    summary: "Short answers about supported links, quality, privacy and devices.",
  },
];
