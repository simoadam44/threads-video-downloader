/**
 * Long-form body copy for the three main tool landing pages.
 *
 * Why this module exists:
 * - `SEO_ROUTES` only carries title/description/summary. The server-rendered
 *   HTML for `/threads-video-downloader`, `/threads-photo-downloader` and
 *   `/threads-carousel-downloader` was therefore one short paragraph, which is
 *   thin content for the pages that are supposed to rank for the product's
 *   primary keywords.
 * - The same blocks are consumed by the Worker (`src/server/content/render.ts`)
 *   and by React (`src/pages/pages.tsx`), so the crawlable HTML and the visible
 *   page cannot drift.
 *
 * Content rules (same bar as `src/lib/info-pages.ts`, enforced by tests):
 * - describe the behaviour that actually exists in this repository;
 * - never promise a quality, speed, size or duration that a post may not have;
 * - no "unlimited", "best", "guaranteed", "watermark-free" or "no watermark"
 *   claims — the tool does not remove watermarks, it only leaves files as they
 *   were published;
 * - no invented statistics, ratings, user counts or testimonials.
 */

export interface ToolSection {
  h2: string;
  /** Paragraphs, rendered in order under the heading. */
  body: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolContent {
  sections: ToolSection[];
  faqs: ToolFaq[];
}

const VIDEO: ToolContent = {
  sections: [
    {
      h2: "What a public Threads video post gives you",
      body: [
        "Paste the link of a public post that contains a video. The downloader reads the post, collects the video files the post actually publishes, and lists them with a preview, the resolution and — when the source includes it — the duration.",
        "Nothing is upscaled, re-encoded or invented. If a post publishes a single MP4 file, you get a single download button. If it publishes several renditions, each one becomes its own option so you can pick the size that suits your device.",
      ],
    },
    {
      h2: "How the quality list is built",
      body: [
        "Each rendition is a separate entry in the result grid. The label under the preview is built from the file metadata of that rendition (its pixel dimensions), not from a fixed menu, so a post that has no 1080p version never shows a 1080p button.",
      ],
      bullets: [
        "Resolution is shown only when the source reports width and height.",
        "Duration is shown only when the source reports it.",
        "File size appears only when the media server sends a content length.",
        "MP4 is the default container because it is what Threads publishes.",
      ],
    },
    {
      h2: "Video posts inside a carousel",
      body: [
        "A carousel can mix photos and videos. Each item is resolved on its own, so a video slide gets the same preview, quality information and buttons as a standalone video, and the photo slides keep their own download buttons.",
        "Download All walks through the items one after another in the order they appear. Browsers may ask for permission before saving more than one file, and the process stops at the first item that fails so you can retry it individually.",
      ],
    },
    {
      h2: "What the tool does not do",
      body: [
        "It does not ask for a Threads login, a password, cookies or an access token, because it only works with posts that anyone can open in a browser. Private, deleted or restricted posts return a clear message instead of a generic error.",
        "It does not modify the media either: the bytes streamed to your device are the bytes the public post serves. No watermark is added, and watermarks that already exist in the source are left untouched.",
      ],
    },
    {
      h2: "Limits you may notice in practice",
      body: [
        "Link resolution is rate-limited to 20 requests per minute per network, which is far above normal manual use but stops scripted abuse. Post metadata is cached for about five minutes, so resolving the same link twice in that window returns the same result immediately.",
        "Downloads are streamed through a short-lived same-origin link (roughly five minutes). Saved files are never kept on the server. If a download link expires because the page stayed open too long, resolve the post again and use the fresh buttons.",
      ],
    },
  ],
  faqs: [
    {
      q: "Why do I only see one quality option?",
      a: "Because that is all the post publishes. The list is built from the files found in the post, not from a fixed catalogue, and the tool does not create higher resolutions that do not exist.",
    },
    {
      q: "Does the downloader convert or compress the video?",
      a: "No. The original file is streamed unchanged, and the extension follows the media type the source serves (usually MP4). Conversion would require re-encoding, which this tool deliberately does not do.",
    },
    {
      q: "Can I get only the audio?",
      a: "Yes, for video items: the MP3 button next to the video download extracts the audio in your browser. It decodes the video track locally and encodes an MP3 file, so very large clips may be refused by the browser.",
    },
    {
      q: "Why did my Threads link fail?",
      a: "The most common causes are a private or deleted post, a profile link instead of a post link, a shortened or tracking link, or an unsupported domain. The how-to-use page walks through each error message.",
    },
    {
      q: "Is this service affiliated with Threads or Meta?",
      a: "No. It is an independent third-party utility that works only with publicly accessible posts, and it is not endorsed by or connected to Threads, Instagram or Meta.",
    },
  ],
};

const PHOTO: ToolContent = {
  sections: [
    {
      h2: "One photo or several, detected automatically",
      body: [
        "Paste a link to a public Threads post that contains a photo. A single-image post produces one result card. A multi-image post is treated as a carousel and every slide is listed separately, so you can save the pictures you want instead of the whole set.",
        "You do not need to tell the tool what kind of post it is. The resolver inspects the post, reports the media it finds and the page renders the matching layout.",
      ],
    },
    {
      h2: "What the preview tells you",
      body: [
        "Each card shows a preview, the item number, the pixel dimensions when the source reports them, and the format the post serves. The preview is loaded lazily so a ten-image carousel does not block the page.",
      ],
      bullets: [
        "Dimensions come from the media metadata, not from a guess.",
        "The format is whatever the post serves — usually JPG, sometimes PNG or WebP.",
        "No thumbnail is ever substituted for the original file: the download button always targets the full-size media.",
      ],
    },
    {
      h2: "Saving the image",
      body: [
        "The Download button streams the original file from the media host through a short-lived same-origin link and saves it with a predictable name such as threads-image-1234567890-2.jpg, where the number identifies the post and the last part is the item index.",
        "Saving does not re-compress the image, does not change its dimensions and does not write a copy to the server. If your browser offers to open the image in a new tab instead of saving it, use the download menu on that tab.",
      ],
    },
    {
      h2: "Photos inside a video carousel",
      body: [
        "Posts that mix photos and videos are handled by the same resolver. Photo items keep their preview and download button, and video items get the extra controls described on the video downloader page.",
      ],
    },
    {
      h2: "When a photo link does not work",
      body: [
        "A link can fail because the post is private or deleted, because it points at a profile rather than a post, or because the post contains no downloadable image. Each case has its own message, and none of them is reported as a successful download.",
        "Repeated attempts from the same network are rate-limited to 20 resolutions per minute. If you hit that, wait a minute and try again rather than refreshing in a loop.",
      ],
    },
  ],
  faqs: [
    {
      q: "Are the saved images compressed?",
      a: "No. The file that reaches your device is the file the public post serves. The tool does not resize, re-encode or re-compress images.",
    },
    {
      q: "Which image format will I get?",
      a: "The one the post serves. Threads commonly serves JPG, but PNG and WebP files also appear, and the extension in the saved filename follows the media type.",
    },
    {
      q: "Can I save every image from a multi-image post?",
      a: "Yes. Each slide has its own Download button, and Download All saves them one after another. Browsers may ask permission before saving multiple files.",
    },
    {
      q: "Do I need a Threads account?",
      a: "No. The tool never asks for a login, password, cookie or token, and it cannot open posts that are not public.",
    },
    {
      q: "Does it work on iPhone?",
      a: "Yes, in Safari or Chrome. On iOS the browser may show a save dialog first; choose Save to Files or Save Image. Android and desktop browsers save directly to the downloads folder.",
    },
  ],
};

const CAROUSEL: ToolContent = {
  sections: [
    {
      h2: "What counts as a carousel",
      body: [
        "A carousel is a public post with more than one media item. Threads allows photos and videos in the same carousel, so the downloader treats every slide as an independent item with its own type, preview and download button.",
        "The order on the page matches the order in the post, which makes it easy to keep a set together when you save it locally.",
      ],
    },
    {
      h2: "How each slide is presented",
      body: [
        "Every item gets a card with the media type, the item number, the pixel dimensions (when available), the duration for videos, a preview and a Download button. Video slides also offer the browser-side MP3 button.",
      ],
      bullets: [
        "A 5-item carousel produces 5 cards, not one archive.",
        "Mixed carousels keep photos and videos in the same grid, in post order.",
        "Nothing is merged into a single preview that hides the individual files.",
      ],
    },
    {
      h2: "Download All: what it actually does",
      body: [
        "Download All loops through the detected items and saves them one at a time, reusing the same short-lived download links as the individual buttons. It is a convenience wrapper, not a server-side archive job.",
        "Because browsers throttle multiple automatic downloads, you may see a permission prompt, or only the first few files may save before the browser pauses. If that happens, use the individual buttons — the links stay valid for the lifetime of the page.",
      ],
    },
    {
      h2: "Why there is no ZIP button",
      body: [
        "Building a ZIP on the server would mean holding every file of the carousel in the Worker's memory or on temporary storage, then streaming an archive back. Cloudflare Workers have a small memory budget, and large videos would fail unpredictably — exactly the kind of opaque failure this tool avoids.",
        "Instead, each file is streamed straight from the media host to your device, with no intermediate copy. That keeps the Worker stateless and makes large carousels as reliable as small ones.",
      ],
    },
    {
      h2: "Carousel limits and error messages",
      body: [
        "Only public posts can be resolved, and the rate limit of 20 link resolutions per minute applies to carousels exactly as it does to single posts. A deleted or private post returns a specific message rather than an empty grid.",
        "If one slide fails to download, the others are unaffected: each button targets its own file, so you can retry only the item that broke.",
      ],
    },
  ],
  faqs: [
    {
      q: "Can I download a whole carousel at once?",
      a: "Yes, with Download All, which saves the detected items one after another. There is no single archive file, because building one server-side would require buffering large media in the Worker.",
    },
    {
      q: "Does it detect the number of slides automatically?",
      a: "Yes. The resolver reports every media item it finds in the public post, and the page renders one card per item. The tool does not invent slides to fill a layout.",
    },
    {
      q: "Can a carousel contain both photos and videos?",
      a: "Yes. Each slide is typed individually, so a mixed carousel shows photo cards and video cards side by side, with the video-specific controls on the video items.",
    },
    {
      q: "Why did only some files download with Download All?",
      a: "Browsers limit how many files a page may save automatically. Allow multiple downloads for the site, or use the individual Download buttons, which are not subject to that limit.",
    },
    {
      q: "Are carousel files stored on your server?",
      a: "No. Files are streamed through a short-lived link and are never written to storage. Only the post's public metadata is cached briefly to avoid repeated lookups.",
    },
  ],
};

export const TOOL_CONTENT: Record<string, ToolContent> = {
  "/threads-video-downloader": VIDEO,
  "/threads-photo-downloader": PHOTO,
  "/threads-carousel-downloader": CAROUSEL,
};

export function toolContentFor(path: string): ToolContent | undefined {
  return TOOL_CONTENT[path];
}
