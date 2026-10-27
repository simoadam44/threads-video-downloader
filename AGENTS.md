# OPERATIONS (implemented 2026-10-05, MVP)

- Stack: React 18 + Vite 6 + TS strict + React Router 6 + @cloudflare/vite-plugin. Single Worker (`src/server/worker.ts`) + Static Assets (`dist/client`).
- Commands: `npm run dev` (frontend) / `npx wrangler dev` (full runtime) / `npm test` (vitest, 167 tests / 16 files) / `npm run build` (tsc + vite + `scripts/gen-static-seo.mjs`) / `npm run preview` / `npx wrangler deploy`. Local full-stack testing used here: `npx wrangler dev --port 8788 --local --var MEDIA_RESOLVER_PROVIDER:mock` (8787 can collide with stale workerd stacks).
- Build note: `vite.config.ts` uses `outDir: "dist"` (plugin nests client to `dist/client`); wrangler assets dir `./dist/client`. Tests use separate `vitest.config.ts` (cloudflare plugin breaks vitest server startup).
- Assets routing (re-fixed + verified 2026-10-27; `run_worker_first` widened 2026-10-27 for host canonicalization): Static Assets previously swallowed every real browser navigation (soft-404s: `/faq`, `/privacy`, `/blog`, tool pages and unknown paths all returned the cached 200 homepage shell), because `not_found_handling` defaulted to SPA mode and the Worker was not guaranteed to see requests. Current config in `wrangler.jsonc` is `"assets": { "directory": "./dist/client", "binding": "ASSETS", "not_found_handling": "none", "run_worker_first": true }`. Verified locally against the generated `dist/threads_video_downloader/wrangler.json`: the Vite plugin **preserves** `binding` and `run_worker_first` (the old 2026-10-07 note about the plugin stripping `binding` no longer holds at @cloudflare/vite-plugin 1.2.0 + wrangler 4.147), `env.ASSETS` is defined, all non-asset paths reach the Worker (real 404s, no soft-404 shell), and the homepage is Worker-SSR'd for crawlable nav/footer + WebSite JSON-LD + security headers. `run_worker_first` is `true` (not `["/"]` as before) **because host canonicalization must also cover static files**: with `["/"]` the edge served `/sitemap.xml`, `/robots.txt`, `/og-image.png` and `/assets/*` on the apex host before the Worker could 301 them. Cost is one Worker invocation per asset request; assets are still cached at the edge and `env.ASSETS.fetch(req)` serves them unchanged. As a side effect the dynamic Worker sitemap/robots (live DB slugs) now always win over the build-time copies in `dist/client/`, which remain as a fallback. `/admin` + `/admin/*` are handled explicitly by the Worker (`adminShell`, `X-Robots-Tag: noindex, nofollow`, `cache-control: no-store`) because `not_found_handling: none` has no SPA fallback. Rebuild (`npm run build`) before testing any config change — `npx wrangler dev` reads the generated config in `dist/`. Do not switch to `not_found_handling: "single-page-application"` (brings the soft-404s back).
- Static sitemap enrichment (added 2026-10-07, host/encoding corrected 2026-10-27): `scripts/gen-static-seo.mjs` fetches live slugs at build time from the published site's public indexes (`GET /api/content/tools` + `/api/content/guides`, both live-only light fields with `updated_at`; override via `SITEMAP_SOURCE_URL`, graceful static-only fallback offline) and merges them into `dist/client/sitemap.xml` with real `<lastmod>` dates (pure helpers `buildSitemapXml`/`escapeXml`/`isSafeSlug`/`encodeLoc` exported for `tests/sitemap-static.test.ts`). `encodeLoc` percent-encodes only non-ASCII path segments (Arabic slugs) and leaves ASCII paths byte-identical; the Worker sitemap (`encodePath` in `worker.ts`) applies the same rule, so static and dynamic sitemaps agree. Absolute URLs always use the canonical `SITE_URL` (`https://www.savethreadsvideos.com`). Note: `wrangler.jsonc` is JSONC, so the script strips whole-line `//` comments before `JSON.parse` (`readSiteUrlFromConfig`, unit-tested); a plain parse used to throw and silently fall back to a hardcoded host, which is how the sitemap once kept the wrong domain. New content workflow: publish in admin (LIVE) → `npm run build` → `npm run deploy`, otherwise new slugs stay out of the served sitemap until the next build. With `run_worker_first: true` the Worker now serves `/sitemap.xml` and `/robots.txt` for every request, so the DB-live dynamic versions win and the build-time copies are a fallback only.
- Resolver: `MEDIA_RESOLVER_PROVIDER=opensource` default (self-hosted, no paid key; technique adapted from tribixbite/yt-dlp-threads, Unlicense — see `docs/open-source-attributions.md`); `mock` for fixtures (`photo`→image, `carousel`→5 items, `private`→PRIVATE_CONTENT, `empty`→MEDIA_NOT_FOUND); `external` optional-only. Isolation: `src/server/resolvers/threads/`.
- Downloads: same-origin `GET /api/dl/<token>` (opaque 5-min tokens for server-resolved URLs only, fbcdn/cdninstagram allowlist, streamed with Referer + attachment filename, never buffered, no open proxy; self-heals expired signatures via one fresh re-resolve, forwards Range/206; frontend saves only verified media payloads). Never truncate media URLs (signed URLs ~1150 chars).
- MP3: per-video button, client-side only (`src/lib/mp3.ts`: Web Audio decode + `@breezystack/lamejs` LGPL-3.0 lazy chunk, 128kbps, ~50MB cap); video download untouched; no Worker changes.
- SEO: server-side rendering for all routes (`SEO_ROUTES` single source + DB slugs, `src/server/content/render.ts`); sitemap/robots served dynamically by Worker (fresh, with live DB slugs) + static build-time copies in `dist/client/` (see assets-routing note: assets win for navigations, so both must stay correct — the build regenerates them on every `npm run build`). Canonical host is **`https://www.savethreadsvideos.com`**; the apex host 301-redirects to it via `canonicalHostRedirect()` in `src/server/worker.ts` (GET/HEAD only, path + query preserved, no loop: the canonical HTTPS host is never redirected, and it fails safe if `SITE_URL` is unset or not a distinct `www.` host). `SITE_URL` in `wrangler.jsonc`, `.env.example`, `src/lib/site.ts`, `index.html`, canonicals, OG/Twitter URLs, sitemap and robots all use it. `HEAD` is supported on every SEO/public-content route with the same status + headers and an empty body.
- UI: light-first minimal per approved screenshot + dark toggle; i18n EN/FR/AR (`src/i18n/*.json`, AR=RTL). No fake stats, third-party disclaimer in footer.
- Security: allowlist threads.net/threads.com, SSRF-safe, 20/min in-memory rate limit, 300s metadata cache, no media buffering, no open proxy.
- Security audit (2026-10-06): CSRF origin check on state-changing admin APIs, HSTS, Retry-After on 429s, redirect-chain host pinning on Threads fetches, credentialed-URL rejection, NaN-safe pagination clamps; `tests/security.test.ts` (SSRF/XSS/traversal matrix); `npm audit` clean except dev-only vitest/tinypool (documented, not shipped). Rate limits are per-isolate in-memory — use Cloudflare dashboard rate-limit rules as the production layer (free).
- Admin + analytics: `src/main.tsx` skips `bootstrapTracking()`/`bootstrapAds()` when `location.pathname` is `/admin` or `/admin/*`. `adminShell` serves those pages with the strict CSP (hash, no `'unsafe-inline'`), so injecting GA4/custom code there produced CSP violations on every admin visit and mixed internal traffic into reports. Admin is private + `noindex`, so it gets no analytics by design.
- SEO & Webmaster (added 2026-10-06): `/admin/seo-webmaster` (GA4/GSC/Bing/Pixel/robots/canonical/custom head-body stored in `app_settings` with format validation); Worker injects into all server-rendered pages without rebuild (60s cache); CSP widens to vendor domains only while tracking configured.
- SEO audit (2026-10-06): real 404 status pages (no soft-404 SPA), trailing-slash 308 canonicalization, `X-Robots-Tag: noindex` on all API JSON, `og:site_name`/`og:locale`, `max-image-preview:large`; `tests/seo-audit.test.ts`; Googlebot-vs-browser parity verified live (identical content, no cloaking).
- Technical SEO audit (2026-10-27, evidence-based): confirmed + fixed (1) soft-404s from Static Assets SPA fallback → `not_found_handling: none` + `binding` + `run_worker_first`; (2) canonical host mismatch (live `www` 301→apex while code/canonicals/sitemap/robots used `www`) → apex everywhere; (3) homepage was served as the bare built shell with no crawlable nav/footer/JSON-LD → Worker-SSR'd homepage via `run_worker_first` + `injectRoot` (balanced-div scanner, because the built `index.html` has fallback markup inside `#root`); (4) `/faq` had no server-rendered answers → SSR from shared `src/lib/faq.ts` + FAQPage JSON-LD; (5) `/admin*` under `not_found_handling: none` would 404 → explicit `adminShell` with `noindex, nofollow`; (6) CSP blocked the inline anti-FOUC theme script → stable sha256 in `src/lib/csp.ts` (hash, not nonce, so responses stay cacheable; a test keeps it in sync with `index.html`); (7) per-page `og:type`/`og:locale`/canonical/description were wrong or missing on SPA routes (`src/lib/site.ts` `applyPageSeo`, `src/pages/pages.tsx`, `src/pages/dynamic.tsx`); (8) `og:image` was SVG → 1200×630 `public/og-image.png` (+ `og:image:width/height/alt`, twitter alt); (9) sitemap `<loc>` was unencoded for Arabic slugs and could duplicate entries → `encodePath`/`encodeLoc` + dedupe (DB first); (10) `HEAD` 404'd on SEO routes; (11) `/api/content/*` + `/api/tracking.json` + `/api/ads.json` now consistently return `noindex, nofollow` public JSON headers. Tests: `tests/seo-audit.test.ts` (20) + `tests/sitemap-static.test.ts` (7); local matrix run against `wrangler dev --local` verified 10/10 `SEO_ROUTES` (200, 1 H1, unique title/H1, apex canonical, `og:type=website`, PNG og:image), Googlebot parity, real 404s, `/faq/`→308, `/index.html`→307, admin noindex, valid sitemap (50 URLs, 42 lastmods, ASCII + percent-encoded Arabic only) and robots, PNG/favicon 200, mock resolver paths, and forged download tokens. Not verifiable from here: Search Console (no access) and DB-backed pages (local generated config has `d1_databases: []`; production uses Supabase).
- CSP/theme hash: `index.html` contains the anti-FOUC inline script; `src/lib/csp.ts` holds its `sha256` and `cspHeaderValue()` (both CSP builders call it). The policy is **production-only**: under `npm run dev` (`import.meta.env.DEV`) no CSP is sent, because Vite injects its own inline React Refresh preamble/HMR client whose hash is not in the policy — sending it there crashed hydration (`@vitejs/plugin-react can't detect preamble`) and rendered the site as unstyled SSR text. `wrangler dev` runs the production build, so CSP is still exercised there; `tests/seo-audit.test.ts` covers both branches. Two hard rules: (1) a hash makes browsers **ignore** `'unsafe-inline'`, so `cspHeaderValue()` drops the theme hash whenever tracking/custom code needs inline scripts (keeping both silently blocked GA4); (2) `https://static.cloudflareinsights.com` + `https://cloudflareinsights.com` are always allowed because the Cloudflare zone injects its Web Analytics beacon into our HTML (not our code). If you edit the inline theme script you MUST recompute the hash — a test fails otherwise (`createHash` in the test).
- AdSense & Ads (added 2026-10-06): `/admin/adsense-ads` (publisher ID `ca-pub-…` validated, auto-ads + 6 placement toggles in `app_settings`); public `/api/ads.json` feeds SPA live (caches busted on save); `AdSlot` renders CLS-safe reserved containers only when enabled (sticky dock closable); auto-ads script server-injected; CSP widens to AdSense domains only while active.
- Plan: `docs/superpowers/plans/2026-10-05-threads-downloader.md`. Technical SEO audit report (2026-10-27): `docs/seo-audit-2026-10-27.md`. Details: `README.md`.
- Admin (added 2026-10-05): `/admin` (login/overview/requests/settings, noindex, robots-disallowed, client-only). API `/api/admin/*` (login rate-limited 5/min, cookie session via Supabase Auth role=admin). DB: Supabase Postgres (`supabase/migrations/0001_admin.sql`: `resolve_events` + `app_settings`, RLS locked, service-role server-side only); local via `npx supabase start` (needs Docker); prod = same code + `wrangler secret put SUPABASE_*`. Resolve events logged fire-and-forget with hashed URL/IP only.
- Dev DB (temporary, no Docker): D1 local (`d1/migrations`, `DB_PROVIDER=d1`, `.dev.vars` gitignored, dev-token login gated on `ENVIRONMENT=dev`); remove `d1_databases` block before prod deploy. Prod = Supabase only. Wrangler v4 (`npm i -D wrangler@4` done: v3 plugin config dropped `database_id`).
- Admin password (dev-only): PBKDF2 hash in `app_settings.admin_password_hash` (`src/server/db/password.ts`, never exposed via settings API); login accepts env bootstrap token or DB password (stateless HMAC session); change via `PUT /api/admin/password` or dashboard Settings → Admin Authentication & Password (`node scripts/hash-password.mjs` helper).
- SEO engines (added 2026-10-06): `/admin/keywords-tools` + `/admin/blog-guides` (CRUD over `tool_pages`/`guides`, D1 `0002` + Supabase `0002` migrations); API enforces unique title/description + min lengths + ≥3 FAQs + reserved-slug guard (no thin/duplicate content); Worker server-renders live slugs (meta/canonical/OG/JSON-LD/cross-links, minimal-shell fallback when assets binding absent) + dynamic sitemap includes them; static sitemap/robots fallback IS emitted at build (see assets-routing note; safe because Worker runs first); React hydrates via `/api/content/*` + `/:slug` + `/blog/:slug` routes. The /blog hub lists live guides everywhere (SSR links + `GET /api/content/guides` light index for the SPA; drafts never leak).
- AI content drafts (added 2026-10-07): provider abstraction in `src/server/ai/` (`types.ts` + `gemini.ts` + `index.ts`, mirrors resolvers pattern; only the free Gemini tier is wired). Admin API `POST /api/admin/ai/draft` (auth + CSRF + `aiLimiter` 8/min to protect the ~1,500 req/day free quota). Key storage: `gemini_api_key` app_setting is WRITE-ONLY — `GET /api/admin/settings` returns only `gemini_key_hint` (`maskApiKey`); env secret `GEMINI_API_KEY`/`GEMINI_MODEL` wins over DB (see `aiConfig`). Key formats: current Auth keys (`AQ.…`, the only format AI Studio issues since mid-2026) plus legacy Standard keys (`AIza…`, deprecated by Google Sep 2026) — see `GEMINI_KEY_RE`. Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `x-goog-api-key` header (never in URL/logs), structured JSON via `generationConfig.responseFormat`, no `temperature` (removed in Gemini 3), 60s AbortController, 400KB response cap. Uniqueness: Worker passes existing titles + FAQ questions + live slugs as prompt context so drafts must differ from every existing page; slug collisions/reserved names get suffixes. Drafts fill the form for human review — never auto-published (Google scaled-content-abuse guardrail). Errors are typed `AiError` (AI_NOT_CONFIGURED/AI_QUOTA/AI_UPSTREAM/AI_BAD_OUTPUT) mapped to 503/429/502 with friendly messages; never leak key/upstream body. Model registry shared: `src/lib/ai-models.ts` (client-importable, keeps server AI code out of the browser bundle). Tests: `tests/ai.test.ts`.

---

Your task is to build a production-ready website called:

THREADS VIDEO DOWNLOADER

The application must be a real, working, scalable, SEO-friendly media downloader for publicly accessible Threads content.

This is NOT a static mockup.

Build the complete application:

* frontend
* API
* media resolver architecture
* download workflow
* validation
* error handling
* SEO
* sitemap
* robots.txt
* structured data
* responsive design
* accessibility
* performance optimization
* Cloudflare Workers deployment
* testing
* documentation

The project must be designed specifically for:

React
Vite
TypeScript
Cloudflare Workers
Cloudflare Workers Static Assets
Cloudflare Vite Plugin
Wrangler

==================================================

1. FIRST: INSPECT THE PROJECT
   ==================================================

Before making changes:

1. Inspect the complete repository.
2. Inspect package.json.
3. Inspect the existing framework.
4. Inspect Vite configuration.
5. Inspect routing.
6. Inspect existing components.
7. Inspect existing API routes.
8. Inspect Cloudflare configuration.
9. Inspect environment variables.
10. Inspect deployment files.
11. Inspect existing SEO implementation.
12. Inspect existing tests.
13. Inspect existing styles and design system.

Do not destroy useful existing code.

If an existing implementation already exists:

* improve it
* preserve useful architecture
* refactor only where necessary

If the project is empty:

* create the application from scratch.

Create or update:

AGENTS.md

Use AGENTS.md to document:

* architecture
* conventions
* commands
* Cloudflare configuration
* SEO requirements
* testing requirements
* deployment rules

Do not leave important architectural knowledge only inside this prompt.

==================================================
2. TECHNOLOGY STACK
===================

Use:

React
Vite
TypeScript
React Router
Cloudflare Vite Plugin
Cloudflare Workers
Workers Static Assets

Prefer modern stable versions compatible with the current environment.

Do NOT blindly install outdated packages.

Use the official Cloudflare Vite integration.

The application must run inside the Cloudflare Workers runtime.

Avoid unnecessary Node.js-only dependencies.

Prefer standard Web APIs:

fetch
Request
Response
URL
Headers
ReadableStream
TransformStream
Web Crypto
AbortController

==================================================
3. CLOUDFLARE ARCHITECTURE
==========================

The production platform is:

Cloudflare Workers + Workers Static Assets

Do NOT use:

* traditional VPS
* Express server
* PM2
* Nginx
* persistent Node.js server
* traditional server filesystem
* Workers Sites legacy architecture

Use one unified full-stack Cloudflare application:

Browser
↓
Cloudflare Edge
↓
Cloudflare Worker
├── React application / static assets
├── SEO routes
├── API routes
├── resolver
├── rate limiting
└── caching

Use the official Cloudflare Vite Plugin.

Create the appropriate:

vite.config.ts

wrangler.jsonc

or the correct current Wrangler configuration format.

Use the current recommended Cloudflare configuration rather than legacy Workers Sites configuration.

==================================================
4. CLOUDFLARE VITE INTEGRATION
==============================

Configure the project using:

@cloudflare/vite-plugin

The Vite configuration should integrate the Cloudflare plugin correctly.

The project must support:

npm run dev
npm run build
npm run preview
npm run deploy

Use:

npx wrangler dev

for Cloudflare runtime development where appropriate.

Use:

npx wrangler deploy

for production deployment.

Do not invent configuration syntax.

Before finishing, verify the configuration against current Cloudflare documentation if needed.

==================================================
5. PROJECT STRUCTURE
====================

Use a clean scalable structure similar to:

src/
components/
pages/
layouts/
routes/
features/
downloader/
media/
seo/
api/
server/
resolvers/
services/
utils/
hooks/
types/
lib/
i18n/
styles/

public/
icons/
images/

scripts/
seo/
prerender/

tests/

Keep frontend and Worker/server code clearly separated.

Do not duplicate business logic between client and Worker.

==================================================
6. PRODUCT
==========

Product name:

Threads Video Downloader

Primary purpose:

Download publicly accessible videos, photos, and carousel media from Threads.

Primary message:

Download Videos & Photos from Threads

The user workflow:

1. Copy a public Threads URL.
2. Paste it into the website.
3. Click Download.
4. Resolve the public media.
5. Display detected media.
6. Select quality or media.
7. Download.

Do not require:

* Threads login
* Threads password
* cookies
* authentication tokens
* private credentials

Only support public content.

Do not implement techniques intended to bypass:

* private accounts
* authentication
* access controls
* CAPTCHAs
* security protections

==================================================
7. MAIN FEATURES
================

Implement:

A. Threads Video Downloader
B. Threads Photo Downloader
C. Threads Carousel Downloader
D. GIF / animated media support where available
E. Profile picture download where reliably available
F. Optional audio extraction architecture
G. Smart media detection
H. Quality selection
I. Download all
J. Mobile support
K. Dark/light theme
L. Multi-language architecture
M. SEO pages
N. FAQ
O. Privacy and legal pages

==================================================
8. THREADS VIDEO DOWNLOADER
===========================

Support:

* MP4 where available
* best available quality
* 1080p
* 720p
* 480p
* 360p
* duration
* resolution
* file size when available
* thumbnail
* video preview

Result example:

Detected Video

[ VIDEO PREVIEW ]

Best Quality
1080p
720p
480p

[ Download ]

Do not display a quality option if it does not actually exist.

Never fabricate:

* resolution
* bitrate
* file size
* duration

==================================================
9. PHOTO DOWNLOADER
===================

Support public Threads image media.

Display:

* preview
* resolution
* format
* file size when available
* download button

Example:

Image 1
1080 × 1350
JPG

[Download]

==================================================
10. CAROUSEL DOWNLOADER
=======================

This is a major product feature.

Automatically detect carousel posts.

Example:

5 media items detected

[Image]
[Image]
[Video]
[Image]
[Image]

Each item must have:

* preview
* type
* resolution
* individual download button

Add:

[ Download All ]

When technically appropriate:

[ Download All as ZIP ]

Do not build a ZIP process that loads huge files entirely into Worker memory.

If ZIP generation would require too much processing:

* offer individual downloads
* or implement a safe streaming strategy
* or document the limitation

==================================================
11. SMART MEDIA DETECTION
=========================

The product must NOT behave like:

URL → one download button

It must behave like:

URL
↓
Analyze public post
↓
Detect media
↓
Return all available media
↓
Show previews
↓
Show quality options
↓
Download

The resolver should normalize the result into:

interface ResolvedPost {
postUrl: string;
postId?: string;
username?: string;
profileUrl?: string;
caption?: string;
thumbnail?: string;
mediaItems: MediaItem[];
}

MediaItem:

interface MediaItem {
id: string;
type: "video" | "image" | "gif" | "audio";
url: string;
thumbnail?: string;
width?: number;
height?: number;
duration?: number;
mimeType?: string;
fileSize?: number;
quality?: string;
extension?: string;
}

==================================================
12. RESOLVER ARCHITECTURE
=========================

IMPORTANT:

Do not tightly couple the entire application to one scraping or extraction implementation.

Create a provider abstraction.

Example:

interface MediaResolverProvider {
canHandle(url: URL): boolean;
resolve(url: URL): Promise<ResolvedPost>;
}

Implement:

ThreadsResolver
ExternalResolver
MockResolver

The application must work with:

MEDIA_RESOLVER_PROVIDER=mock

during local development.

Production should support an external provider:

MEDIA_RESOLVER_PROVIDER=external

MEDIA_RESOLVER_API_URL=
MEDIA_RESOLVER_API_KEY=

Do not expose resolver credentials to the client.

The frontend must not know which resolver provider is being used.

The resolver can be replaced later without rewriting the frontend.

==================================================
13. THREADS URL VALIDATION
==========================

Support valid public URLs on supported Threads domains.

At minimum:

threads.net
threads.com

Support valid public post URLs.

Also support supported public sharing URL variants where the resolver can handle them.

Reject:

* javascript:
* data:
* file:
* localhost
* private/internal URLs
* unsupported domains
* arbitrary external URLs
* malformed URLs

Prevent SSRF.

Never allow user input to turn the Worker into a generic URL-fetching proxy.

Normalize URLs before processing.

==================================================
14. API
=======

Create a clean Worker API.

Primary endpoint:

POST /api/resolve

Request:

{
"url": "https://www.threads.net/..."
}

Response:

{
"success": true,
"data": {
"postUrl": "...",
"postId": "...",
"username": "...",
"profileUrl": "...",
"caption": "...",
"thumbnail": "...",
"mediaItems": []
}
}

Errors:

{
"success": false,
"error": {
"code": "INVALID_URL",
"message": "Please enter a valid public Threads URL."
}
}

Supported error codes:

INVALID_URL
UNSUPPORTED_URL
NOT_FOUND
PRIVATE_CONTENT
MEDIA_NOT_FOUND
RESOLVER_UNAVAILABLE
RATE_LIMITED
TEMPORARY_ERROR
DOWNLOAD_FAILED
UNKNOWN_ERROR

Never expose internal exceptions or stack traces.

==================================================
15. API HEALTH
==============

Create:

GET /api/health

Return a lightweight health response.

Example:

{
"ok": true
}

Do not expose:

* provider API keys
* server internals
* environment secrets
* resolver credentials

==================================================
16. DOWNLOAD ARCHITECTURE
=========================

CRITICAL:

Do NOT buffer large videos inside Worker memory.

Never use:

await response.arrayBuffer()

or:

await response.blob()

for large remote media files.

Prefer direct media downloads where safe.

Possible architecture:

User
↓
Worker
↓
Resolver
↓
Safe media URL
↓
Direct download

or:

User
↓
Worker
↓
Resolver
↓
ReadableStream
↓
User

If streaming through the Worker:

* stream data
* do not buffer entire files
* use ReadableStream
* use AbortController
* enforce timeout
* handle upstream failures

If using direct URLs:

* do not expose resolver API credentials
* validate the media destination
* never allow arbitrary user-defined target URLs

The Worker must not become an unrestricted proxy.

==================================================
17. DOWNLOAD FILENAMES
======================

Generate safe filenames.

Examples:

threads-video-{postId}.mp4

threads-image-{postId}-{index}.jpg

threads-media-{postId}-{index}.mp4

threads-{postId}-media.zip

Sanitize usernames and IDs.

Do not allow path traversal.

==================================================
18. RATE LIMITING
=================

Protect:

POST /api/resolve

and any server-side download/proxy endpoint.

Prefer the Cloudflare Workers Rate Limiting API when available.

Do not implement an inaccurate homemade IP-only system unless necessary.

The rate limiting layer should support resource-specific limits.

Example conceptual configuration:

resolve:
20 requests / minute

download:
10 requests / minute

Use environment/configuration rather than hardcoding values everywhere.

Return:

429 Too Many Requests

with a friendly message.

The design must remain configurable for future free/paid tiers.

==================================================
19. CACHING
===========

Avoid resolving the same URL repeatedly.

Normalize the URL.

Generate a deterministic cache key.

Use Cloudflare-compatible caching.

Potential options:

Workers Cache API
Workers KV
short-lived metadata cache

Do not store downloaded media permanently.

Cache only safe public metadata.

Example:

RESOLVE_CACHE_TTL=300

Do not cache private data.

Do not permanently retain user content unless explicitly required.

==================================================
20. SECURITY
============

Implement:

* strict URL validation
* domain allowlist
* SSRF protection
* timeout protection
* response size protection
* safe redirects
* secure headers
* CSP where compatible
* CORS policy
* API rate limiting
* safe filename handling
* environment variable protection
* error sanitization

Never expose:

MEDIA_RESOLVER_API_KEY
internal URLs
internal stack traces
server environment variables
provider credentials

==================================================
21. FRONTEND DESIGN
===================

Build a premium SaaS-style UI.

Brand:

Threads Video Downloader

Do NOT use the official Threads logo.

Do NOT copy the official Threads interface.

Create an independent visual identity inspired by the type of minimal modern social-media tools users expect.

Visual direction:

* premium
* modern
* dark-first
* clean
* fast
* professional
* minimal
* conversion-focused

Suggested colors:

#080B14
#0F1320
#111827

Accent:

#8B5CF6
#A855F7
#EC4899
#6366F1

Support:

dark mode
light mode

Avoid excessive gradients.

Use gradients only as accents.

==================================================
22. HOMEPAGE
============

Header:

Logo/icon

Threads Video Downloader

Navigation:

Home
How It Works
Features
FAQ

Right:

Theme toggle
Language selector

Hero badge:

Fast • Free • No Login Required

H1:

Threads Video Downloader

Subheadline:

Download Videos & Photos from Threads Quickly and Easily

Description:

Paste a public Threads link and download available videos, photos, and carousel media in high quality.

Main input:

[ Paste Threads URL here... ]

Button:

[ Download ]

Helper:

Example:
https://www.threads.net/@username/post/...

==================================================
23. HERO PRODUCT VISUAL
=======================

Create an original product visual.

It should show:

* mobile social media post preview
* video preview
* media results
* quality selector
* download controls
* subtle gradient shapes

Do not use official Threads screenshots.

Do not use the official Threads logo.

==================================================
24. RESULT UI
=============

After URL resolution:

Show:

MEDIA FOUND

@username

Caption if available

[Preview]

Then dynamic results.

For video:

Video
1920 × 1080
00:32

Quality:

Best Quality
1080p
720p
480p

[Download]

For images:

Image 1
Image 2
Image 3

[Download]

For carousel:

5 media files found

[Grid]

[Download All]

[Download All as ZIP]

Add:

New Download

==================================================
25. UX STATES
=============

Implement polished states:

Idle
Loading
Resolving
Resolved
Downloading
Success
Error
Rate Limited
Unsupported URL
Private Content
No Media Found
Resolver Unavailable

Do not make errors technical.

Instead of:

"HTTP 502 from resolver"

Show:

"Something went wrong while retrieving this media. Please try again."

==================================================
26. URL INPUT UX
================

Support paste behavior.

If the user pastes text containing a valid Threads URL:

extract the URL safely.

Example:

"Check this out:
https://www.threads.net/@username/post/abc123"

The application should detect:

https://www.threads.net/@username/post/abc123

where appropriate.

Add a paste button when browser APIs permit.

Validate before making API requests.

==================================================
27. FEATURE SECTION
===================

Create:

Why Choose Our Threads Downloader?

Feature cards:

Super Fast
High Quality
No Login Required
No Software Required
No Watermark Added
Mobile Friendly
Desktop Friendly
Privacy Focused
Simple Interface
Free to Use

Do not claim unlimited downloads unless technically guaranteed.

Do not claim that the tool removes watermarks.

Use:

"No Watermark Added"

instead.

==================================================
28. HOW IT WORKS
================

Three steps:

1. Copy the Threads Link
2. Paste the Link
3. Download Your Media

Each step needs:

* icon
* short explanation
* clear visual hierarchy

==================================================
29. FAQ
=======

Create accessible accordion FAQ.

Questions:

What is Threads Video Downloader?

How do I download a Threads video?

Can I download Threads photos?

Can I download a carousel post?

Can I download multiple images?

Does it work on iPhone?

Does it work on Android?

Do I need a Threads account?

Why is my Threads link not working?

Can I download private Threads posts?

Is the service free?

What video quality is available?

Do you store downloaded videos?

Who operates this website?

Answers must be honest.

Explicitly state:

* private content is not supported
* no Threads credentials are required
* only publicly accessible content is supported
* the site is an independent third-party tool
* downloaded media is not permanently stored by default

==================================================
30. SEO ARCHITECTURE
====================

SEO is a primary requirement.

Do NOT rely exclusively on client-side JavaScript for SEO content.

Public SEO pages must produce crawlable HTML.

Use:

* SSR
  or
* build-time prerendering/SSG

depending on the chosen React/Vite architecture.

Do NOT create a purely client-rendered SPA where all important SEO content appears only after JavaScript executes.

The primary public routes should be server-rendered or prerendered.

==================================================
31. SEO PAGES
=============

Create:

/
/threads-video-downloader
/threads-photo-downloader
/threads-carousel-downloader
/threads-gif-downloader
/threads-profile-picture-downloader
/threads-video-downloader-1080p
/threads-video-downloader-for-iphone
/threads-video-downloader-for-android
/how-to-download-threads-videos
/faq
/privacy
/terms
/contact

Create:

/blog

Prepare architecture for future articles.

==================================================
32. SEO PAGE QUALITY
====================

Do not generate thin pages.

Each indexable page must have:

* unique title
* unique meta description
* unique H1
* useful content
* relevant FAQs
* internal links
* canonical URL
* Open Graph
* social metadata
* structured data where appropriate

Do not keyword stuff.

Use natural language.

==================================================
33. HOMEPAGE SEO
================

Title:

Threads Video Downloader - Download Threads Videos & Photos

Meta description:

Download public Threads videos, photos and carousel media in high quality. Fast, free and easy to use with no login required.

H1:

Threads Video Downloader

Do not duplicate the exact same title on every SEO page.

==================================================
34. CANONICAL URLS
==================

Every public page must have:

rel="canonical"

Use:

SITE_URL

from environment/configuration.

Prevent duplicate URLs caused by:

* query strings
* trailing slash differences
* route variants
* internal API URLs
* alternate paths

==================================================
35. SITEMAP
===========

Create a real production sitemap:

/sitemap.xml

The root URL must work:

https://DOMAIN.com/sitemap.xml

Do not make the production sitemap dependent on:

/api/sitemap

unless there is a specific architecture reason.

Generate sitemap entries from a centralized route registry.

Include only indexable canonical pages.

Exclude:

/api/*
temporary routes
debug pages
private routes

The sitemap must use the production SITE_URL.

==================================================
36. ROBOTS.TXT
==============

Create:

/robots.txt

Allow:

* homepage
* SEO pages
* blog
* public documentation

Disallow:

* /api/
* internal routes
* debug routes
* private/admin paths

Include:

Sitemap: https://DOMAIN.com/sitemap.xml

Use SITE_URL dynamically.

==================================================
37. STRUCTURED DATA
===================

Implement JSON-LD where appropriate:

WebSite
WebApplication
FAQPage
BreadcrumbList

Do not fabricate:

* ratings
* reviews
* user counts
* company facts

Only include factual structured data.

==================================================
38. OPEN GRAPH
==============

Each major page must have:

og:title
og:description
og:url
og:type
og:image

Also configure:

twitter:card
twitter:title
twitter:description
twitter:image

Create an original social preview image.

Do not use official Threads artwork or logos.

==================================================
39. INTERNAL LINKING
====================

Use contextual internal links.

For example:

Threads Video Downloader
→ Threads Photo Downloader

Threads Carousel Downloader
→ How to Download Threads Videos

FAQ
→ Video Downloader

Blog article
→ relevant downloader tool

Avoid artificial keyword stuffing.

==================================================
40. INTERNATIONALIZATION
========================

Prepare a real i18n architecture.

Languages:

English
French
Arabic

Default:

English

Use translation files:

locales/en.json
locales/fr.json
locales/ar.json

Arabic must support:

dir="rtl"

French and English:

dir="ltr"

Do not translate at runtime using an external translation API.

Keep translations structured and maintainable.

==================================================
41. THEME
=========

Support:

Dark theme
Light theme

Persist preference locally.

Respect:

prefers-color-scheme

Avoid flashing the wrong theme during page load.

==================================================
42. ACCESSIBILITY
=================

Follow WCAG-oriented best practices.

Implement:

* semantic HTML
* keyboard navigation
* visible focus
* accessible labels
* ARIA only when necessary
* good contrast
* alt text
* reduced motion
* accessible dialogs
* accessible accordions
* screen-reader-friendly status updates

==================================================
43. RESPONSIVE DESIGN
=====================

Test:

320px
375px
414px
768px
1024px
1440px
1920px

Mobile requirements:

* no horizontal overflow
* large touch targets
* responsive cards
* accessible buttons
* easy URL paste
* large download buttons
* optimized media previews

==================================================
44. PERFORMANCE
===============

Target:

Lighthouse Performance 90+
Accessibility 95+
Best Practices 95+
SEO 95+

Optimize:

* JavaScript
* CSS
* images
* fonts
* hydration
* API calls
* route loading
* component loading
* caching

Avoid unnecessary dependencies.

Do not load large libraries when native browser APIs are sufficient.

==================================================
45. CLOUDFLARE STATIC ASSETS
============================

Use Cloudflare Workers Static Assets.

Do not use legacy Workers Sites.

The deployment must allow:

* React assets
* CSS
* JS
* images
* favicon
* SEO files
* static assets

Cloudflare should serve static assets efficiently through the edge.

Keep API logic inside Worker code.

==================================================
46. CLOUDFLARE CONFIGURATION
============================

Create a production-ready Wrangler configuration.

It must include the appropriate:

name
main
compatibility_date

and Cloudflare plugin-compatible configuration.

Do not hardcode obsolete dates or old configuration syntax.

Use the current date or current supported compatibility date based on the environment when creating the project.

Do not manually invent generated Wrangler fields if the Vite plugin generates them.

Use the configuration pattern recommended by the current Cloudflare Vite plugin.

==================================================
47. CLOUDFLARE BINDINGS
=======================

Use bindings only when they provide real value.

Possible bindings:

Rate Limiting
KV
D1
R2
Analytics Engine
Assets

Do not introduce D1/R2/KV unnecessarily.

For the MVP, prefer stateless behavior.

Use KV only if short-lived cross-location metadata caching is actually needed.

Do not store large media in KV.

Do not use R2 simply because it exists.

==================================================
48. CLOUDFLARE RATE LIMITING
============================

Where supported, use Cloudflare's native Rate Limiting binding.

Create route-specific protection.

Example:

RESOLVE_RATE_LIMIT

DOWNLOAD_RATE_LIMIT

Keep configuration in Wrangler.

Do not depend entirely on IP addresses.

Do not create a fragile home-made rate limiter when Cloudflare-native rate limiting is available.

==================================================
49. CACHE
=========

Use Workers Cache API for appropriate HTTP responses.

For resolver metadata:

* consider short TTL
* normalize URL
* hash cache key
* avoid storing sensitive data

For static content:

* use Cloudflare asset caching

For media:

* prefer direct upstream media delivery

Do not permanently store downloaded media.

==================================================
50. DOWNLOAD STREAMING
======================

If the Worker must proxy a file:

Use streaming.

Never:

await response.arrayBuffer()

for large files.

Never:

await response.blob()

for large files.

Use:

ReadableStream

and stream the response.

Set appropriate:

Content-Type
Content-Disposition
Cache-Control

Do not buffer large media into memory.

Use AbortController for upstream timeout control.

==================================================
51. MEDIA URL SAFETY
====================

Never expose an arbitrary proxy endpoint like:

/api/download?url=ANY_URL

This is unsafe.

If a download endpoint is required:

* only accept server-generated media references
* use short-lived signed/opaque tokens
* validate the target
* enforce supported media hosts
* prevent SSRF

The user must never be able to turn the server into a general internet proxy.

==================================================
52. OPTIONAL AUDIO
==================

Prepare the architecture for:

Audio Download
MP3
Original audio

Do not introduce FFmpeg or server-side media conversion unless it is actually compatible with Cloudflare Workers and necessary.

If conversion is not practical on Workers:

* keep the provider abstraction
* support original audio URLs when available
* clearly document the limitation

==================================================
53. PROFILE PICTURE
===================

If the resolver reliably provides public profile image media:

Display:

Profile Picture

[Preview]

[Download]

If not reliably supported:

* do not fake the feature
* gracefully report unsupported media type

==================================================
54. ANALYTICS
=============

Create an analytics abstraction.

Track events such as:

page_view
download_started
download_completed
download_failed
media_detected
quality_selected
download_all
copy_url
language_changed

Do not hardcode the application around one vendor.

Possible providers later:

Cloudflare Web Analytics
Plausible
Umami
Google Analytics

Use:

ANALYTICS_ENABLED=false

initially unless configured.

Do not send unnecessary personal data.

==================================================
55. ADS / MONETIZATION
======================

Prepare an ad-slot abstraction.

Create:

AdSlot

Possible placements:

hero-bottom
results-bottom
content-middle
faq-top
footer

Environment:

ADS_ENABLED=false

When disabled:

render nothing

Do not let ads interrupt:

* input
* result preview
* download button

Do not build intrusive popups.

==================================================
56. PRIVACY
===========

Create:

/privacy

State clearly:

* no Threads credentials required
* only public content supported
* downloaded media is not permanently stored by default
* analytics behavior if enabled
* third-party resolver use where applicable

Do not make unsupported privacy claims.

==================================================
57. TERMS
=========

Create:

/terms

Explain:

* acceptable use
* public content only
* user responsibility
* copyright responsibility
* third-party status

Do not present the website as affiliated with Threads or Meta.

==================================================
58. COPYRIGHT / CONTACT
=======================

Create:

/contact

Include a clear contact mechanism.

Explain that users should only download/use content they have permission to use.

Do not invent a legal company name or address.

Use configurable contact information.

==================================================
59. FOOTER
==========

Create footer sections:

Product

* Video Downloader
* Photo Downloader
* Carousel Downloader
* GIF Downloader

Resources

* How It Works
* FAQ
* Blog

Legal

* Privacy
* Terms
* Contact

Footer disclaimer:

"This website is an independent third-party tool and is not affiliated with or endorsed by Threads or Meta."

==================================================
60. 404
=======

Create a real 404 page.

It must:

* have correct HTTP 404 behavior
* maintain website branding
* offer a button back to home
* avoid returning the homepage with HTTP 200

==================================================
61. ERROR PAGES
===============

Create:

404
500
Unsupported URL
Private content
No media
Rate limited
Resolver unavailable

All must have consistent visual design.

==================================================
62. BLOG ARCHITECTURE
=====================

Prepare:

/blog

Create reusable article architecture.

Potential initial articles:

How to Download Threads Videos
How to Save Threads Photos
How to Download Threads Carousel Posts
How to Download Threads Videos on iPhone
How to Download Threads Videos on Android
How to Download HD Threads Videos
Why a Threads Download Link May Not Work

Do not generate massive amounts of thin AI content.

Build a real content architecture that can grow organically.

==================================================
63. SEO CONTENT QUALITY
=======================

Avoid:

keyword stuffing
fake statistics
fake testimonials
fake reviews
fake users
fake download counts

Write natural, useful content.

Use related terminology naturally.

==================================================
64. SITE MAP
============

Maintain a central route definition.

Example:

SEO_ROUTES = [
"/",
"/threads-video-downloader",
"/threads-photo-downloader",
"/threads-carousel-downloader",
"/threads-gif-downloader",
"/threads-profile-picture-downloader",
"/threads-video-downloader-1080p",
"/threads-video-downloader-for-iphone",
"/threads-video-downloader-for-android",
"/how-to-download-threads-videos",
"/faq",
"/privacy",
"/terms",
"/contact"
]

Use this route registry for:

* sitemap
* internal linking
* metadata
* breadcrumbs
* canonical generation

Avoid duplicate route definitions.

==================================================
65. TYPESCRIPT
==============

Use strict TypeScript.

Create shared domain types.

Examples:

MediaType
MediaItem
ResolvedPost
ResolverResponse
ResolverError
QualityOption
DownloadOption
SEOPage

Do not duplicate interfaces across files.

Avoid:

any

unless absolutely necessary.

==================================================
66. COMPONENT ARCHITECTURE
==========================

Create reusable components:

Header
Footer
Hero
UrlInput
PasteButton
DownloadButton
DownloadForm
MediaResult
MediaPreview
VideoPreview
ImagePreview
MediaGrid
QualitySelector
MediaItemCard
DownloadAllButton
LoadingState
ErrorState
FeatureSection
HowItWorks
FAQ
LanguageSwitcher
ThemeToggle
AdSlot
Breadcrumbs
SEOHead / equivalent
Toast

Keep business logic out of presentational components.

==================================================
67. API SERVICE ARCHITECTURE
============================

Create server-side services:

url-validator
resolver-service
cache-service
rate-limit-service
download-service
analytics-service

Keep them independently testable.

==================================================
68. ERROR HANDLING
==================

Use typed errors.

Example:

class ResolverError extends Error {
code: string;
}

Do not return internal implementation details.

Create consistent HTTP status codes.

Examples:

400 invalid input
404 no media
403 private content where applicable
429 rate limited
500 internal error
503 resolver unavailable

==================================================
69. MOCK RESOLVER
=================

Create:

MockResolver

It must support realistic data for:

1. Video
2. Image
3. Carousel

This allows complete UI development without an external API.

Environment:

MEDIA_RESOLVER_PROVIDER=mock

The UI must be fully usable in mock mode.

==================================================
70. REAL RESOLVER ADAPTER
=========================

Create:

ExternalResolver

with environment variables:

MEDIA_RESOLVER_API_URL=
MEDIA_RESOLVER_API_KEY=

Never expose the key to frontend JavaScript.

Use timeout.

Use retries only when appropriate.

Do not endlessly retry failed requests.

Normalize provider responses to the internal:

ResolvedPost

type.

==================================================
71. RESOLVER FAILOVER
=====================

Create provider selection logic.

Example:

if provider === "mock"
MockResolver

if provider === "external"
ExternalResolver

Make it possible to add later:

ThreadsResolverV2

without modifying frontend code.

==================================================
72. API SECURITY
================

The resolver endpoint must:

* validate method
* validate content type
* validate JSON
* validate URL
* normalize URL
* rate limit
* resolve
* normalize result
* sanitize output

Limit:

* request body size
* string lengths
* metadata sizes

==================================================
73. CORS
========

Use a strict CORS policy.

For same-origin production requests:

* prefer same-origin behavior

Do not allow:

Access-Control-Allow-Origin: *

unless genuinely required.

Make CORS configurable for development.

==================================================
74. CACHE HEADERS
=================

Use appropriate caching for:

static assets
public SEO pages
API responses
resolver metadata

Do not accidentally cache:

* errors containing sensitive data
* secrets
* personalized data
* private data

==================================================
75. SECURITY HEADERS
====================

Configure appropriate headers such as:

Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy

Do not blindly enable restrictive CSP that breaks the application.

Verify in production.

==================================================
76. MOBILE UX
=============

The mobile experience is extremely important.

On mobile:

Hero input:
full width

Download:
large accessible button

Results:
stacked cards

Carousel:
responsive grid

Video:
proper aspect ratio

Avoid:

* tiny text
* tiny buttons
* horizontal scrolling
* desktop-only interactions

==================================================
77. VISUAL DESIGN
=================

Use:

premium dark SaaS aesthetic

Background:

#080B14

Cards:

#111827

Borders:

subtle dark borders

Accent gradients:

Purple
Violet
Pink

Typography:

modern geometric sans-serif

Do not use excessive decoration.

The UI should feel like a premium utility tool rather than an advertising-heavy downloader.

==================================================
78. MICRO-INTERACTIONS
======================

Add subtle:

hover states
focus states
loading animation
success feedback
button transitions
card entrance

Respect:

prefers-reduced-motion

Avoid:

* giant animations
* excessive parallax
* distracting effects

==================================================
79. ACCESSIBILITY
=================

Every interactive control must be usable with keyboard.

Images require meaningful alt text.

Loading state must be announced appropriately.

Download progress must be understandable.

Accordion FAQ must support keyboard interaction.

==================================================
80. ENVIRONMENT VARIABLES
=========================

Create:

.env.example

Include:

SITE_URL=
MEDIA_RESOLVER_PROVIDER=mock
MEDIA_RESOLVER_API_URL=
MEDIA_RESOLVER_API_KEY=

RESOLVE_CACHE_TTL=300

ANALYTICS_ENABLED=false
ANALYTICS_PROVIDER=
ANALYTICS_ID=

ADS_ENABLED=false

RATE_LIMIT configuration if needed.

Never commit:

* .env
* API keys
* secrets

==================================================
81. CLOUDFLARE SECRETS
======================

Production secrets must be stored using Cloudflare secret/binding mechanisms.

Do not put:

MEDIA_RESOLVER_API_KEY

inside:

* frontend JS
* public assets
* Vite client environment
* HTML
* Git

==================================================
82. README
==========

Create comprehensive README.md.

Include:

Project overview
Features
Architecture
Technology stack
Local development
Environment variables
Mock resolver
External resolver
SEO
Sitemap
Robots
Cloudflare setup
Cloudflare deployment
Custom domain
Analytics
Ads
Testing
Troubleshooting
Known limitations

==================================================
83. GIT IGNORE
==============

Ensure .gitignore includes:

node_modules
dist
.wrangler
.env
.env.local
coverage
temporary files
generated secrets

==================================================
84. TESTS
=========

Create tests for:

URL validation
domain validation
URL normalization
resolver selection
resolver normalization
API errors
media type detection
quality selection
filename generation
rate limiting
cache keys
SEO metadata
sitemap generation
robots.txt generation

==================================================
85. END-TO-END TEST
===================

Create a full E2E flow:

Open homepage
↓
Paste mock Threads URL
↓
Submit
↓
Loading state
↓
Resolved result
↓
Display preview
↓
Select quality
↓
Download
↓
Success

Test:

* video
* photo
* carousel
* invalid URL
* unsupported URL
* no media

==================================================
86. PERFORMANCE TEST
====================

Verify:

* production build
* bundle size
* lazy loading
* image optimization
* no unnecessary dependencies
* no hydration issues
* fast first render
* no layout shift caused by media

==================================================
87. SEO TEST
============

Verify every SEO page:

title
meta description
H1
canonical
Open Graph
Twitter metadata
structured data
internal links

Verify:

/robots.txt

/sitemap.xml

Verify that important SEO content appears in HTML without requiring client-side execution.

==================================================
88. CLOUDFLARE TEST
===================

Verify:

npm run dev

npm run build

npm run preview

npx wrangler dev

npx wrangler deploy

Verify:

* worker
* static assets
* API routes
* SEO routes
* sitemap
* robots
* custom 404

==================================================
89. CLOUDflare STATIC ASSETS
============================

Do not manually implement an old-style static bucket architecture.

Use the current Workers Static Assets + Cloudflare Vite plugin architecture.

Let the Vite/Cloudflare integration determine the production client asset output where appropriate.

Do not use deprecated Workers Sites configuration.

==================================================
90. NODE COMPATIBILITY
======================

Do not assume full Node.js runtime availability inside Workers.

Avoid unnecessary use of:

* fs
* child_process
* net
* persistent sockets
* process-specific APIs

If Node compatibility is genuinely needed:

* verify Cloudflare support
* enable only what is necessary
* document why

Prefer Web APIs.

==================================================
91. NO TRADITIONAL FILE STORAGE
===============================

Do not use the Worker filesystem for runtime storage.

The application should be stateless by default.

Do not save downloaded videos to local disk.

Do not create a traditional downloads folder on the Worker.

==================================================
92. PRIVACY BY DEFAULT
======================

Do not store:

* Threads credentials
* user passwords
* private cookies
* authentication tokens

Do not permanently store downloaded media.

Minimize analytics data.

==================================================
93. PRODUCT TRUST
=================

Show trust signals:

Public content only
No login required
No password required
Fast processing
Privacy focused
Independent third-party tool

Do not fabricate:

* number of users
* number of downloads
* ratings
* testimonials

==================================================
94. LEGAL BRANDING
==================

The product must clearly identify itself as an independent third-party utility.

Do not imply affiliation with:
Threads
Meta

Do not use their official branding as your own logo.

==================================================
95. OPTIONAL BLOG
=================

Prepare article metadata structure:

title
description
slug
date
modifiedDate
author
image
content
faq
relatedTools

Keep content architecture independent from the downloader API.

==================================================
96. ROUTING
===========

Use React Router with a scalable route structure.

Public routes must be indexable.

API routes must be handled by the Worker and never become client-rendered pages.

Use a catch-all 404 strategy appropriate for Cloudflare Workers and React.

Ensure unknown paths produce actual 404 behavior where appropriate.

==================================================
97. SEO RENDERING STRATEGY
==========================

Choose the best compatible strategy between:

SSR
SSG
prerendering

The final implementation must satisfy:

* crawlable HTML
* correct metadata on direct requests
* fast page render
* compatible Cloudflare deployment
* no dependency on browser-only JavaScript for essential SEO text

Do not use a client-only SEO library as the only SEO solution.

==================================================
98. SITEMAP GENERATION
======================

Implement one authoritative sitemap generator.

It should automatically produce:

url
lastmod
changefreq where meaningful
priority only if useful and valid

Do not spam fake lastmod dates.

Use only canonical indexable URLs.

==================================================
99. robots.txt
==============

Serve:

/robots.txt

from the root.

It must be valid plain text.

Include sitemap.

Do not block useful public pages.

==================================================
100. FINAL UI QUALITY
=====================

The result must feel like a real SaaS product.

Do NOT create:

generic Bootstrap UI
generic Tailwind template
cheap-looking downloader page
overly bright neon design
too many gradients
stock illustrations
fake testimonials
fake statistics
fake reviews
massive ads
poor typography
huge unnecessary whitespace

The primary action should be immediately visible:

PASTE THREADS URL → DOWNLOAD

==================================================
101. DEVELOPMENT WORKFLOW
=========================

Work in phases.

PHASE 1
Inspect repository.

PHASE 2
Create/update AGENTS.md.

PHASE 3
Confirm architecture.

PHASE 4
Set up React/Vite + Cloudflare Vite Plugin if needed.

PHASE 5
Build design system.

PHASE 6
Build homepage.

PHASE 7
Build downloader components.

PHASE 8
Build API.

PHASE 9
Build URL validation.

PHASE 10
Build resolver abstraction.

PHASE 11
Build MockResolver.

PHASE 12
Build ExternalResolver.

PHASE 13
Build media result system.

PHASE 14
Build download workflow.

PHASE 15
Build rate limiting.

PHASE 16
Build caching.

PHASE 17
Build SEO rendering.

PHASE 18
Build sitemap.

PHASE 19
Build robots.txt.

PHASE 20
Build FAQ.

PHASE 21
Build privacy / terms / contact.

PHASE 22
Build internationalization.

PHASE 23
Build analytics abstraction.

PHASE 24
Build ad-slot abstraction.

PHASE 25
Testing.

PHASE 26
Performance audit.

PHASE 27
Security audit.

PHASE 28
Cloudflare deployment verification.

==================================================
102. OPEN-CODE WORKFLOW
=======================

Before editing:

* inspect repository
* inspect package.json
* inspect routing
* inspect Vite
* inspect Cloudflare config
* inspect existing tests

Use available tools.

Use official documentation when compatibility matters.

Do not guess configuration syntax.

Do not silently ignore build errors.

Do not stop after frontend implementation.

Do not leave essential features as TODO comments.

If a real media resolver requires an API key that is not available:

1. implement the complete resolver adapter
2. use MockResolver locally
3. document the required environment variables
4. make the rest of the application fully functional

==================================================
103. DO NOT OVERENGINEER THE MVP
================================

Do not create:

* unnecessary database
* unnecessary authentication
* unnecessary dashboards
* unnecessary microservices
* unnecessary queues
* unnecessary cloud infrastructure

Start stateless.

Only add:
KV
D1
R2
Durable Objects
Queues
Workflows

when there is a concrete technical reason.

==================================================
104. FIRST VERSION PRIORITY
===========================

The first production version must prioritize:

1. Threads Video Downloader
2. Threads Photo Downloader
3. Threads Carousel Downloader
4. Smart Media Detection
5. Quality Selection
6. Download
7. Responsive UI
8. SEO
9. Sitemap
10. Cloudflare deployment
11. Security
12. Rate limiting
13. Mock/External Resolver abstraction

Secondary features:

GIF
Profile picture
Audio

must be architected cleanly but should not compromise the core product.

==================================================
105. FINAL ACCEPTANCE CHECKLIST
===============================

Before declaring complete:

[ ] Repository inspected
[ ] AGENTS.md created/updated
[ ] React configured
[ ] Vite configured
[ ] TypeScript strict
[ ] Cloudflare Vite Plugin configured
[ ] Wrangler configured
[ ] Workers Static Assets configured
[ ] Worker API works
[ ] Homepage works
[ ] Video downloader works in mock mode
[ ] Photo downloader works in mock mode
[ ] Carousel works in mock mode
[ ] Smart detection works
[ ] Quality selection works
[ ] Download UI works
[ ] Resolver abstraction works
[ ] External resolver adapter exists
[ ] URL validation works
[ ] SSRF protection exists
[ ] Rate limiting exists
[ ] Caching exists
[ ] Error states exist
[ ] 404 works
[ ] Privacy exists
[ ] Terms exists
[ ] Contact exists
[ ] FAQ exists
[ ] English exists
[ ] French architecture exists
[ ] Arabic RTL architecture exists
[ ] Theme switching works
[ ] Mobile works
[ ] Accessibility checked
[ ] SEO metadata exists
[ ] Canonical exists
[ ] Open Graph exists
[ ] JSON-LD exists
[ ] robots.txt works
[ ] sitemap.xml works
[ ] Sitemap contains only canonical indexable URLs
[ ] Public SEO content is crawlable
[ ] Analytics abstraction exists
[ ] AdSlot abstraction exists
[ ] Production build passes
[ ] TypeScript passes
[ ] Tests pass
[ ] Cloudflare preview works
[ ] Cloudflare deployment works
[ ] README complete
[ ] No secrets exposed
[ ] No deprecated Workers Sites architecture
[ ] No large media buffering in Worker memory
[ ] No unrestricted URL proxy
[ ] No fake statistics/reviews
[ ] No unsupported claims

==================================================
106. FINAL REPORT
=================

After implementation, provide a concise final report containing:

1. What was built.
2. Final architecture.
3. Main features.
4. File/folder structure.
5. API endpoints.
6. Resolver providers.
7. Environment variables.
8. Cloudflare configuration.
9. SEO implementation.
10. Sitemap implementation.
11. Tests executed.
12. Build result.
13. Deployment instructions.
14. Known limitations.
15. Anything that still requires a real external resolver API key.

Do not claim something is production-ready if it was not actually tested.

Start by inspecting the repository now.
