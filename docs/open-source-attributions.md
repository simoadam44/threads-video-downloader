# Open-source attributions

## tribixbite/yt-dlp-threads

- Repository: https://github.com/tribixbite/yt-dlp-threads
- Author: tribixbite
- License: **Unlicense** (public domain — see repository LICENSE file).
  Permits commercial use, modification, and deployment without attribution;
  attributed here voluntarily.
- What was adapted (algorithm, not copied code — Python/yt-dlp framework
  could not run on Workers, so the technique was reimplemented in
  TypeScript against Web APIs):
  - `yt_dlp_plugins/extractor/threads.py` → `ThreadsIE._real_extract`:
    fetch post page with Googlebot UA; resolve `/share/` links via
    canonical `og:url`; select post strictly by shortcode.
    Ported to: `src/server/resolvers/threads/threads-fetch.ts`,
    `threads-parser.ts` (`shortcodeFromOgUrl`, `shortcodeFromUrl`, `selectPost`).
  - `ThreadsIE._extract_posts` + `_collect_posts`: regex over
    `<script type="application/json">` blocks, tolerant per-block JSON
    parse, recursive collection of dicts carrying `code` plus one of
    `video_versions` / `video_dash_manifest` / `image_versions2` /
    `carousel_media`. Ported to: `extractJsonBlocks`, `collectPosts`.
  - `ThreadsIE._formats_from_media`: progressive mp4 extraction with
    URL-path dedupe of re-signed variants. Ported to: `videoItems` in
    `threads-media.ts` (DASH manifests intentionally not converted to
    segmented downloads — Workers must not buffer media).
  - `ThreadsIE._media_entry` thumbnails (`image_versions2.candidates`)
    extended to full single-image and carousel-image items (the plugin
    itself is video-only; the same embedded structures carry the images).
  - `_efg_info` (duration from CDN `efg` base64 param) ported to
    `decodeEfgDuration` in `threads-media.ts`.
- Modifications: iterative (non-recursive) collection with operation guards,
  3MB page cap with streaming reader, 8s timeout + single retry with
  backoff, typed `ResolverError` mapping, strict no-fallback matching,
  poster-vs-download separation for video carousel entries.

No other third-party extraction code is used. No paid service, proxy,
Apify, RapidAPI, or downloader website is involved at any step.

## @breezystack/lamejs (MP3 encoder)

- Package: https://www.npmjs.com/package/@breezystack/lamejs (fork of
  https://github.com/zhuker/lamejs)
- License: **LGPL-3.0** (copyleft). Used under LGPL terms via lazy dynamic
  `import()` as an isolated, replaceable chunk loaded only when the user
  clicks the MP3 button; no modifications made to the library.
- Used for: client-side-only MP3 encoding (`Mp3Encoder`, 128kbps) in
  `src/lib/mp3.ts`. Server-side conversion is impossible on Workers.
