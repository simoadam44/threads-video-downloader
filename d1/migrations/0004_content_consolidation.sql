-- Content consolidation — local D1 mirror of the Supabase migration 0004.
-- See src/server/content/redirects.ts for the authoritative list.

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
  'threads-video-length-limit-utility',
  'best-threads-video-downloader-online',
  'how-to-download-threads-video-on-iphone-mobile-browser',
  'how-to-download-threads-video-on-iphone-mobile-browser-2',
  'how-to-download-instagram-reels-web-tool'
);

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
