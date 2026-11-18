-- Content consolidation (mirrors src/server/content/redirects.ts)
--
-- The Worker already answers 301 for every slug below (see RETIRED_TOOL_SLUGS
-- and RETIRED_GUIDE_SLUGS) and drops them from the sitemap, so this migration
-- is bookkeeping: it stops the admin content list from advertising pages that
-- the edge no longer serves, and it prevents anyone "fixing" a live page that
-- is unreachable.
--
-- Nothing is deleted. Re-publishing a row means setting status = 'live' again
-- AND removing its line from the redirect map, in that order.
--
-- Not applied automatically by the deployment: run `npx supabase db push`
-- (Supabase) or `npx wrangler d1 migrations apply` (local dev) when approved.

-- Video downloader permutations → /threads-video-downloader
update tool_pages set status = 'draft'
where slug in (
  'threads-video-downloader-hd',
  'download-threads-video-in-1080p',
  'threads-video-downloader-free-browser-utility',
  'threads-video-downloader-no-login',
  'threads-video-downloader-web-utility',
  'threads-video-save-browser-tool',
  'download-threads-video-by-link-utility',
  'save-threads-reels-video-tool',
  'threads-video-downloader-for-pc',
  'threads-video-downloader-unlimited-access-utility',
  'threads-video-download-without-watermark-tool',
  'threads-to-mp4-video-conversion-tool',
  'threads-mp4-downloader-tool',
  'threads-video-length-limit-utility'
);

-- Listicle with nothing to compare → /
update tool_pages set status = 'draft'
where slug = 'best-threads-video-downloader-online';

-- Duplicate iPhone how-to → /how-to-download-threads-videos
update tool_pages set status = 'draft'
where slug in (
  'how-to-download-threads-video-on-iphone-mobile-browser',
  'how-to-download-threads-video-on-iphone-mobile-browser-2'
);

-- Promises a platform the resolver rejects → 410
update tool_pages set status = 'draft'
where slug = 'how-to-download-instagram-reels-web-tool';

-- Guides that duplicate a tool page or a stricter page.
update guides set status = 'draft'
where slug in (
  'blog-save-threads-video-workflow',
  'blog-threads-video-save-complete-workflow',
  'blog-mastering-threads-video-downloader-usage',
  'threads-video-downloader-online-without-registration-guide',
  'blog-download-threads-carousel-images-guide',
  'blog-threads-photo-downloader-tutorial',
  'threads-to-mp4-conversion-guide',
  'how-to-download-threads-videos-in-hd-complete-guide',
  'threads-gif-downloader-guide',
  'threads-video-download-without-watermark-guide',
  'blog-extract-audio-from-threads-video',
  'threads-video-to-mp3-audio-extraction-guide',
  'how-to-download-threads-videos-desktop',
  'download-threads-videos-on-iphone-guide',
  'download-threads-videos-without-an-app'
);
