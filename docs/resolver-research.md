# Resolver research (2026-10-05)

Goal: replace the paid `ExternalResolver` dependency with a self-hosted,
open-source Threads extractor that runs on Cloudflare Workers.

## Candidates

| Repository | URL | Language | License | Video | Photo | Carousel | Login needed | Paid/API needed | Python/FFmpeg/Browser needed | Workers-compatible | Activity | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tribixbite/yt-dlp-threads | https://github.com/tribixbite/yt-dlp-threads | Python (yt-dlp plugin) | Unlicense (public domain) | Yes | Data present (`image_versions2`) | Yes (`carousel_media`) | No (crawler UA) | No | Only yt-dlp framework (not needed for the algorithm) | Algorithm portable (fetch+regex+JSON+base64) | 2026-08, maintained | **SELECTED** |
| yt-dlp PR #13512 (Threads extractor) | https://github.com/yt-dlp/yt-dlp/pull/13512 | Python | Unlicense (PR terms) | Yes | Partial | Yes (playlist) | Optional cookies | No | yt-dlp framework | Same technique, corroborates | Open PR, updated 2025-12 | Supporting evidence |
| LayorX/threads-dlp | https://github.com/LayorX/threads-dlp | Python | MIT | Yes | — | — | **Yes (cookies)** | No | **Docker + traffic sniffing + VPS** | No | 2025-10 | Rejected (login + heavy runtime) |
| itsmaxyd/threads-downloader | JS (browser ext.) | **GPL-3.0** | Yes (user profile pages) | Browser session | Browser session | Browser session | No | No | **Needs real browser; GPL copyleft** | No | 2025-12 | Rejected (license + architecture) |
| rekon307/ThreadsScraper | Python | Unclear | Metrics/images | — | — | **Yes (cookies)** | No | **Playwright + Docker** | No | 2026-01 | Rejected (login + runtime) |
| Apify actors / RapidAPI | Various | Commercial | Yes | Yes | Yes | No | **Paid** | Varies | N/A | Rejected (paid dependency) |

## Why tribixbite/yt-dlp-threads

1. **License**: Unlicense = public domain. Commercial use, modification, and
   deployment permitted without attribution (attributed anyway).
2. **No login/cookies**: fetches the public post page with a crawler
   User-Agent, which Meta answers with a server-rendered payload.
3. **Pure algorithm**: HTTP GET + `<script type="application/json">` regex +
   `JSON.parse` + recursive key search + base64 — every step maps 1:1 to
   Workers Web APIs (`fetch`, `RegExp`, `JSON`, `atob`).
4. **Strict post matching**: selects by shortcode, refuses to fall back to
   unrelated posts — the exact safety property our product needs.
5. **Images + carousels in the same data**: `image_versions2.candidates`
   (full images, width/height) and `carousel_media[]` are parsed by the same
   structures the plugin uses for thumbnails — verified by our fixtures.

## Known fragility (documented honestly)

- Meta serves the full payload to crawlers **today**; it can stop or reshape
  the JSON at any time. The resolver treats every step as fallible and
  degrades to `MEDIA_NOT_FOUND` / `RESOLVER_UNAVAILABLE`, never guessed data.
- Worker-egress IPs may be challenged more aggressively than residential IPs;
  see live-test results in the final report / README.
- DASH manifests (`video_dash_manifest`) are intentionally not parsed into
  segmented downloads (Workers must not buffer segments); progressive
  `video_versions` mp4 URLs are returned directly.
