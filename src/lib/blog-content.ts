/**
 * Copy for the `/blog` hub.
 *
 * Shared by the Worker renderer (`renderStaticRoute`) and the React page, so the
 * crawlable HTML and the hydrated page cannot drift. Before this module the hub
 * held only a list of links, which left the page with ~20 words of body text
 * once navigation is discounted — thin content on an indexable hub.
 *
 * Content rules (enforced by tests/blog-content.test.ts): describe what the
 * guides and the tool actually do; never claim "unlimited", "guaranteed",
 * "watermark-free", ratings or user counts; never invent support hours.
 */

import type { ToolSection } from "./tool-content";
import type { HomeLink } from "./home-content";

export const BLOG_INTRO =
  "Every guide here answers one question a visitor actually asked: how do I save this public Threads post, and why did it not work? The articles are written from the behaviour of this downloader, so the steps match the buttons on the tool pages rather than paraphrasing the Threads app.";

export const BLOG_SECTIONS: ToolSection[] = [
  {
    h2: "What the guides cover",
    body: [
      "The video, photo and carousel guides take one media type each: what a post has to contain for it to work, what the result panel shows, and which button saves which file. The device guides cover the part that actually differs on iOS and Android — where the browser puts the saved file and how to move it out of the Downloads folder — while the desktop guide stays with the browser workflow.",
      "The audio guide explains the built-in MP3 step: the sound is decoded in your browser from the video you already have, so nothing is re-uploaded and the server does not convert media.",
    ],
  },
  {
    h2: "What the tool cannot do",
    body: [
      "Private accounts, posts that need a login, deleted posts and posts whose media the platform has already removed are out of reach. The resolver reads only what a signed-out visitor can see, so those cases are reported as unsupported or not found instead of returning an empty result.",
      "Quality is not chosen by this site: it is whatever renditions the post publishes. A post with one 720p file gives one 720p download. The tool adds no watermark of its own, and it does not remove a watermark that exists in the original file.",
    ],
  },
  {
    h2: "Before you save anything",
    body: [
      "Downloading a public file is not the same as having the right to republish it. Keep the original post link next to the file, credit the person who made it, and use the media only in the ways the creator and the platform rules allow — personal offline viewing is the usual case; reposting someone else's work as your own is not.",
      "If you are the rights holder and a post of yours is being saved through this tool, the contact page explains what to include in a request.",
    ],
  },
  {
    h2: "If a link does not work",
    body: [
      "A link usually fails for a short list of reasons: it is a profile link instead of a post link, it was copied only in part, the post is private or deleted, or the platform changed how the page is served. The how-to page walks through the checks in order, and the FAQ covers the common cases.",
    ],
  },
];

/** Contextual links under the hub copy — anchor text is each page's own H1. */
export const BLOG_LINKS: HomeLink[] = [
  {
    href: "/threads-video-downloader",
    label: "Threads Video Downloader",
    summary: "Save the MP4 renditions a public post actually publishes.",
  },
  {
    href: "/threads-photo-downloader",
    label: "Threads Photo Downloader",
    summary: "Save photos with their real dimensions and format.",
  },
  {
    href: "/threads-carousel-downloader",
    label: "Threads Carousel Downloader",
    summary: "Walk a multi-item post one file at a time.",
  },
  {
    href: "/how-to-download-threads-videos",
    label: "How to download Threads videos",
    summary: "The three-step workflow, including the failure cases.",
  },
];
