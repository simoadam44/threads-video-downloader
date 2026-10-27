# Threads Video Downloader

Independent third-party tool to save **public** Threads videos, photos and carousel media. No login required. Not affiliated with Threads or Meta.

## Features

- Video / photo / carousel detection with previews, resolution, quality info
- Quality pills show only qualities that actually exist (never fabricated)
- Download All (sequential individual downloads; no Worker-side ZIP to avoid memory buffering)
- Light minimal UI matching spec screenshot + dark mode toggle, EN/FR/AR (AR = RTL)
- SEO: server-rendered HTML for every route (`SEO_ROUTES` single source + DB slugs), `/sitemap.xml`, `/robots.txt`, canonical/OG/Twitter/JSON-LD on every page; real 404s, `HEAD` support, apex canonical host `https://savethreadsvideos.com`
- Security: Threads-domain allowlist, SSRF protection, rate limiting (20/min resolve), short metadata cache, no open proxy, no media buffering in Worker

## Tech stack

React 18 + Vite 6 + TypeScript strict + React Router 6 + `@cloudflare/vite-plugin` + Wrangler. Single Cloudflare Worker serves static assets + API.

## Local development

```bash
npm install
npm run dev        # Vite dev (frontend only)
npm test           # vitest (159 tests / 16 files)
npm run build      # tsc + vite build + static sitemap/robots + og image assets (all SEO pages render server-side at request time)
npm run preview    # preview production build
npx wrangler dev   # full Worker runtime (assets + API)
npx wrangler deploy
```

## Environment variables

See `.env.example`. Key vars:

| Var | Purpose |
|---|---|
| `SITE_URL` | Canonical/sitemap/robots base — apex, no `www`: `https://savethreadsvideos.com` |
| `MEDIA_RESOLVER_PROVIDER` | `opensource` (default, no key) \\| `mock` (dev fixtures) \\| `external` (optional paid API) |
| `RESOLVE_CACHE_TTL` | Metadata cache seconds (300) |

Mock hints: any URL → video; URL containing `photo` → image; `carousel` → 5 items; `private` → PRIVATE_CONTENT; `empty`/`nomedia` → MEDIA_NOT_FOUND.

## Media extraction (no paid API required)

The default `OpenSourceResolver` (`src/server/resolvers/threads/`) extracts public
Threads media without any paid resolver API or API key. Technique adapted from
[tribixbite/yt-dlp-threads](https://github.com/tribixbite/yt-dlp-threads) (Unlicense,
public domain — see `docs/open-source-attributions.md`): the Worker fetches the
public post page (threads.net/threads.com only) as a link-preview crawler, parses
the embedded public post JSON, matches strictly by post shortcode, and returns
direct video/image/carousel media URLs. No login, no cookies, no CAPTCHA handling,
no private-content access; media is delivered as direct URLs (never buffered).

**Downloads go through the Worker** (`GET /api/dl/<token>`): Meta CDN links are
signed and expire, and bare-browser navigation can be rejected ("Bad URL hash"),
so each resolved item carries a short-lived opaque token. The Worker validates
the token, enforces an allowlist (`*.fbcdn.net`, `*.cdninstagram.com`), re-fetches
with the proper request context, and **streams** the bytes with
`Content-Disposition: attachment` and a safe filename. If the signed URL expired,
the Worker re-resolves the same item fresh once (self-healing) instead of saving
an error payload as a corrupt file; Range requests are forwarded (206) for
seekable playback. The frontend verifies the payload is real media before saving
and shows a friendly error otherwise. No `?url=` open proxy
exists; tokens reference only server-resolved URLs and expire in 5 minutes.

**Audio (MP3):** each video card has an independent **MP3** button. Server-side
conversion is impossible on Workers (no FFmpeg), so extraction runs in the
browser: fetch via `/api/dl` → Web Audio decode → 128kbps MP3 via
`@breezystack/lamejs` (LGPL-3.0, see `docs/open-source-attributions.md`),
loaded lazily only on first MP3 click. Saved as `threads-audio-{postId}.mp3`.
Source cap ~50MB; video download flow is completely untouched.
Note: sanitizers must never truncate media URLs (real signed URLs run ~1150
chars — truncation breaks their signatures).

Correct claim: the core resolver needs **no paid resolver API or key**. Cloudflare
(runtime/rate limits) and Threads (layout changes, request challenges) can still
impose operational limits — see below. Research: `docs/resolver-research.md`.

## API

- `POST /api/resolve` `{ "url": "https://www.threads.net/..." }` → `{ success, data: ResolvedPost }` or `{ success: false, error: { code, message } }`
- `GET /api/health` → `{ ok: true }`
- `GET /sitemap.xml`, `GET /robots.txt` — served by the Worker (SITE_URL-based, includes live DB slugs) **and** emitted as static files in `dist/client/` at build time; Static Assets wins for real browser navigations, so the build regenerates both on every `npm run build`. `HEAD` returns the same status/headers with an empty body.

## Technical SEO notes

- Canonical host is the **apex** (`https://savethreadsvideos.com`); `www` 301-redirects to it in production. `SITE_URL`, every canonical, OG/Twitter URL, the sitemap and robots all use apex.
- `wrangler.jsonc` sets `assets.not_found_handling: "none"`, `assets.binding: "ASSETS"` and `run_worker_first: ["/"]`. That combination is what makes real 404s, Worker-served SSR (crawlable nav/footer/JSON-LD on the homepage) and `env.ASSETS` all work; do not switch back to `single-page-application` handling. `/admin` + `/admin/*` are served explicitly by the Worker with `X-Robots-Tag: noindex, nofollow`.
- Per-page metadata (canonical, description, `og:type`, `og:locale`) is applied by `src/lib/site.ts#applyPageSeo`; server-side head injection lives in `src/server/content/render.ts`.
- Social image is `public/og-image.png` (1200×630 PNG; SVG og:images are not supported by major platforms).
- The anti-FOUC inline theme script in `index.html` is allowed by CSP via a sha256 hash in `src/lib/csp.ts`; a test fails if the two drift. The CSP is sent in production only — `npm run dev` omits it because Vite's own inline React Refresh preamble would be blocked (that used to break hydration in dev). `wrangler dev` runs the production build, so it still verifies the real headers. When tracking/ads/custom code is configured the policy switches from the hash to `'unsafe-inline'` (a hash would make browsers ignore it), and the Cloudflare Web Analytics beacon hosts are always allowed because the zone injects them.

## Deployment

1. `npx wrangler login`
2. Set `SITE_URL` in `wrangler.jsonc` vars to your domain
3. `npm run deploy` (runs `wrangler deploy`) — no resolver key needed.
   Only if you explicitly choose `MEDIA_RESOLVER_PROVIDER=external`:
   `wrangler secret put MEDIA_RESOLVER_API_KEY` (+ `MEDIA_RESOLVER_API_URL` var).

## Known limitations

- `OpenSourceResolver` reads publicly served Threads pages as a crawler. Meta can
  change its markup/JSON or challenge Worker-egress requests at any time; the
  resolver then returns a friendly `MEDIA_NOT_FOUND`/`RESOLVER_UNAVAILABLE` error
  instead of guessed data. Only `src/server/resolvers/threads/` needs updating
  when that happens — API contract and frontend stay stable.
- Link-attachment posts (no native media, e.g. link shares) return the post's
  link-preview image labeled with quality `preview` — the only media available.
- Giphy/GIF attachments and DASH-segment downloads are not supported.
- Free operation has bounds: Cloudflare runtime/rate limits apply, and aggressive
  retrying is deliberately avoided (one retry with backoff).
- No server-side ZIP/MP3 conversion (incompatible with Workers memory model); documented in UI copy.
- Rate limiter and cache are in-memory per isolate; swap to native Rate Limiting binding / KV when scaling (interfaces ready).

## Admin dashboard + database

Two database paths share one `DbProvider` interface (`src/server/db/`):

**A. TEMPORARY local testing without Docker (D1, default for now):**
```bash
cp .dev.vars.example .dev.vars   # set ADMIN_DEV_TOKEN (gitignored, local only)
npx wrangler d1 migrations apply tvd-admin-dev --local
npx wrangler dev --local          # open /admin/login (email: admin, password: ADMIN_DEV_TOKEN)
```
`DB_PROVIDER=d1` + `ENVIRONMENT=dev` in `.dev.vars`. The dev-token login works **only** when `ENVIRONMENT=dev`. Before production deploy: remove the `d1_databases` block from `wrangler.jsonc` and delete the dev-token code path reliance (Supabase takes over).

**B. Supabase (local via Docker, or Cloud for production):**
```bash
npx supabase start     # API :54321, Studio :54323, DB :54322
npx supabase db reset  # re-apply supabase/migrations + seed
npx supabase stop
```

1. Open Studio → Authentication → add user (`ADMIN_EMAIL`), then grant admin role:
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email='...';`
2. Copy the local `anon key` (`npx supabase status`) into `.dev.vars` (gitignored) with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `IP_HASH_SALT`.
3. `npx wrangler dev --local` → open `/admin/login` (email `admin`, password = dashboard password, see below).

Login password (dev D1): stored as a PBKDF2 hash in `app_settings.admin_password_hash`
(never exposed via the settings API). Set it with `node scripts/hash-password.mjs "New-Pass"`
then store the output via `wrangler d1 execute tvd-admin-dev --local`, or change it anytime
in the dashboard: Settings → **Admin Authentication & Password** (current + new + confirm,
min 8 characters). The bootstrap `ADMIN_DEV_TOKEN` from `.dev.vars` always works as a fallback in dev.

## SEO & Webmaster (`/admin/seo-webmaster`)

Stores GA4 ID, Search Console + Bing verification, Meta Pixel ID, robots
indexing toggle, canonical base domain, and custom head/body code in
`app_settings`. The Worker injects them into **every server-rendered page**
(static routes, tool pages, guides) with no rebuild — settings are cached 60s.
All values are format-validated server-side; custom code is admin-trusted
content (guarded API + CSRF check) and the CSP is widened to vendor domains
only while tracking is configured (documented in the security notes).

## AdSense & Ads (`/admin/adsense-ads`)

Stores the AdSense publisher ID (`ca-pub-…` format-validated), auto-ads toggle,
and six placement toggles (header, below_search, above_result, midpage, footer,
sticky) in `app_settings`. The public `/api/ads.json` feeds the SPA instantly
(no rebuild; caches busted on save). The `AdSlot` component renders reserved,
CLS-safe fixed-size containers with responsive AdSense units only where enabled
(sticky dock includes a close button); nothing renders without a publisher ID.
Auto-ads script is injected server-side when enabled, and the CSP widens to
AdSense domains only while ads are active.

Endpoints (all admin-guarded except login): `POST /api/admin/login|logout`, `GET /api/admin/stats`, `GET /api/admin/requests`, `GET/PUT /api/admin/settings` (allowlisted keys only), `PUT /api/admin/password` (dev-only). Content CRUD: `GET/POST /api/admin/tool-pages|guides`, `GET/PUT/DELETE /api/admin/tool-pages/:id|guides/:id` (SEO validation enforced: unique title/description, min lengths, ≥3 FAQs). Every `/api/resolve` call is logged fire-and-forget (hashed URL + hashed IP, no PII).

## SEO engines (Keywords & Tools + Blog & Guides)

Admin sections `/admin/keywords-tools` and `/admin/blog-guides` manage DB-driven
landing pages (root slugs like `/threads-video-downloader-hd`, EN + AR) and
long-tail guides (under `/blog/:slug`). Each live entry requires: unique
title (30-160), meta description (120-320), H1, substantial body/intro, ≥3 FAQs
— thin/duplicate content is rejected by the API (409/400), never just warned.

Public delivery is crawlable without JS: the Worker server-renders each live
slug (unique meta + canonical + OG/Twitter + JSON-LD `WebApplication`/`Article`/
`FAQPage`, related-links graph) and includes all live slugs in the dynamic
`/sitemap.xml`. Build-time static copies (`scripts/gen-static-seo.mjs`) also
exist so real browser navigations get valid XML/text from Static Assets (see
AGENTS.md assets-routing note). The React app hydrates interactivity via
`/api/content/tool/:slug` and `/api/content/guide/:slug` plus dynamic routes.
Seed content: `d1/seed-tools.sql`, `d1/seed-guides.sql` (apply to Supabase with
the matching `supabase/migrations/0002_seo_content.sql` on cloud).

Production (Supabase Cloud, zero code changes): create cloud project → apply `supabase/migrations` (`supabase db push`) → create admin user + role → `wrangler secret put` for `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `IP_HASH_SALT` → `npm run deploy`.

## AI content drafts (Gemini — free tier)

Both engines (`/admin/keywords-tools` and `/admin/blog-guides`) have an
**AI Content Generator (Gemini — free tier)** settings card and a
**"Generate with AI from Target Keyword"** button in every add/edit form.

Setup (first time only):

1. Get a free key at `https://aistudio.google.com/apikey` (no credit card; free tier ≈ 1,500 requests/day per model).
2. Paste it into the AI settings card on either engine page and pick a model (default `gemini-3.8-flash`, the current stable Flash model recommended for new projects). The key is stored server-side (DB setting), is **never returned by any API** (masked, e.g. `AQ.A…NGEg`), and never reaches the browser bundle. Alternatively, keep it out of the database entirely: `wrangler secret put GEMINI_API_KEY` (env secret beats the stored key).

What it does:

- `POST /api/admin/ai/draft` builds a prompt from your **existing titles, FAQ questions and live slugs**, then asks Gemini (structured JSON output) for a draft that must differ from every existing page: unique title/H1/meta, 4-5 new FAQs, and at least one concrete differentiator (device-specific steps, edge cases, troubleshooting). No invented stats, reviews, or user counts; no "written by AI" phrasing; no affiliate claims; target language (en/fr/ar).
- The draft lands in the form for **review**. Nothing is auto-published — you edit, then save (status defaults to `draft`). The server reports warnings (e.g., field below validation minimum) and enforces the same uniqueness/length rules on save (409/400).
- Drafts pass through the same sanitizer + validation as hand-written content before they can be saved.
- Free-tier quota is protected by an 8-requests/minute admin limiter; upstream 429s map to a friendly "quota" message. Upstream errors never expose the key, provider internals, or stack traces.
- Switch models (e.g. to `gemini-2.5-flash` or `gemini-3.6-flash`) when a model is unavailable in your region or its quota is exhausted — each model has its own free quota. If generation is refused, the error names the upstream HTTP status: check the key is complete, remove any website/IP restrictions on the key in AI Studio (server calls come from Cloudflare), or try another model.

This keeps content human-reviewed: Google's scaled-content-abuse policy is about publishing low-value pages at scale, and the review step plus DB-level uniqueness rules is the guardrail.
