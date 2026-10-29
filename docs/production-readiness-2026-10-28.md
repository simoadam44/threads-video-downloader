# Production readiness — 2026-10-28

Scope: the trust pages, the shared server/client copy, the working contact form, and a
content-quality review of the 23 live tool pages and 19 live guides.

Status: **deployed to production on 2026-10-29** (commit `52740d9`, Worker version
`a679d6be-cbde-4a48-8b1e-a940657d8ba0`). The production database has **not** received
`0003_contact.sql`, so the contact endpoint correctly reports `accepting:false` and the
form shows its unavailable notice. Nothing in this document changes DNS, nameservers,
Cloudflare SSL settings or `canonicalHostRedirect()`.

Companion documents:

- `docs/adsense-readiness-2026-10-27.md` — what was built, why, and the AdSense risks.
- `docs/canonical-host-2026-10-27.md` — canonical host decision and verification.
- `docs/seo-audit-2026-10-27.md` — technical SEO audit.

---

## 1. Verified local results

Environment: `npm run build` output served by
`npx wrangler dev -c dist/threads_video_downloader/wrangler.json --port 8788 --local --var MEDIA_RESOLVER_PROVIDER:mock`
(no D1 binding in that generated config, so the contact form is expected to report
itself unavailable — that is the "no database" branch, not a bug).

| Check | Result |
|---|---|
| `npm test` | **220 tests / 19 files passed** (new: `tests/tool-content.test.ts` 5; existing `tests/info-pages.test.ts` 30, `tests/contact.test.ts` 16) |
| `npx tsc --noEmit` | exit `0`, no output |
| `npm run build` | passed — client `index-CNnBRGMq.js` **302.29 kB** (gzip 94.17 kB), CSS 9.77 kB (gzip 2.80 kB), lazy `lamejs` 168.95 kB (gzip 58.47 kB), `static SEO: 53 sitemap URLs (23 tools + 19 guides live)` |
| Static verification script (57 checks) | **ALL CHECKS PASSED** (`%TEMP%\opencode\verify-static.ps1`) |
| `/threads-video-downloader` | `200`, 1 `<h1>`, 729 words in `<main>`, canonical, `FAQPage`, `BreadcrumbList`, no `noindex` |
| `/threads-photo-downloader` | `200`, 1 `<h1>`, 603 words in `<main>`, canonical, `FAQPage`, `BreadcrumbList` |
| `/threads-carousel-downloader` | `200`, 1 `<h1>`, 652 words in `<main>`, canonical, `FAQPage`, `BreadcrumbList` |
| `/about`, `/how-to-use`, `/privacy`, `/terms`, `/disclaimer`, `/contact` | `200`, one `<h1>`, body copy ≥ 200 words, `BreadcrumbList`, no invented contact details |
| `/how-to-download-threads-videos` | `200`, no `FAQPage` (its Q/A is not on that page — correct) |
| `/sitemap.xml` | `200`, canonical host only, no `/api/`, includes the three tool pages and the trust pages |
| `/robots.txt` | `Sitemap:` line on `https://www.savethreadsvideos.com`, `/api/` disallowed |
| Unknown path | real `404` (not the homepage with `200`) |
| `/about/` | `308` to `/about` |
| `HEAD /about` | `200`, empty body |
| `/api/health` | `{"ok":true}` |
| `/api/contact` GET (no DB) | `200 {"success":true,"data":{"accepting":false,"email":null}}` |
| `/api/contact` POST (no DB) | `503 CONTACT_UNAVAILABLE`, friendly message, `no-store`, `noindex` |
| `/contact` in the browser (no DB) | article renders, form **replaced** by an unavailable notice, no email shown, no fake success |
| Lighthouse `/threads-photo-downloader` | **Accessibility 100 / Best Practices 100 / SEO 100**, no failures |
| Layout at 320 / 375 / 768 / 1440 px | `scrollWidth - innerWidth == 0` on the three tool pages; hero pill and `<h1>` do not overlap (measured 0 px) |
| Rendered text (browser, hydrated) | video 777, photo 648, carousel 700 words — identical sections/FAQ on server and client |

Not verifiable from this machine: the production database, production Lighthouse,
Search Console, and a real email round-trip (there is no mail provider).

---

## 2. Production facts (checked live, read-only)

| Fact | Evidence |
|---|---|
| Deployed version | `095ba9e1-f43d-4873-84c6-9c36e36b52e5` |
| `/api/contact` | `404` with `{"code":"UNKNOWN_ERROR"}` — the route is **not deployed** yet |
| Trust pages | `/about`, `/how-to-use`, `/disclaimer` return `404`; they exist only in the local working tree |
| Rewritten legal pages | `/privacy`, `/terms`, `/contact` are live but still serve the old stubs — e.g. `/privacy` is 29 words and still contains the "Fast and easy" placeholder |
| Tool-page long-form copy | Not live; production still renders the short registry paragraph (30–33 words on two of the three pages) |
| GA4 | `G-G57VCHWGMX` present on public pages |
| Cloudflare Web Analytics | Beacon present (injected by the Cloudflare zone, not by this code) |
| AdSense | No AdSense script; `/api/ads.json` returns `pubId:""` and every slot `false` |
| Live sitemap | 53 URLs = 13 registry routes + 40 reachable DB entries |

---

## 3. Contact form — real prerequisites and behaviour

The form is not decorative. Its behaviour is driven by the server:

1. `GET /api/contact` probes the inbox (60 s cache of **successful** probes only) and
   returns `{accepting, email}` with `no-store` + `noindex`.
2. When the probe fails, the React form **hides itself** behind "Contact form
   temporarily unavailable". It never pretends to send.
3. `POST /api/contact` validates again server-side — JSON only, 16 KB cap,
   `Sec-Fetch-Site` CSRF check, honeypot, shared rules in `src/lib/contact-rules.ts`,
   3 messages / 10 min per network — and inserts into `contact_messages`.
4. **Messages are not emailed.** There is no mail provider, no forwarding, no
   autoresponder. The only delivery channel is the admin inbox at `/admin/messages`.
5. No automated retention job exists. Deletion is manual (`DELETE
   /api/admin/messages/:id`, `404` if the id is gone). The privacy page says messages
   are kept until the request is resolved and for a reasonable follow-up period; that
   is an **operational obligation for the owner**, not something the code enforces.

Prerequisites, traced in code:

| Prerequisite | Where it comes from | State |
|---|---|---|
| Database reachable | `getDb()` prefers Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` are set, else D1 when bound | Production uses Supabase (admin + content already work) |
| `contact_messages` table exists | `supabase/migrations/0003_contact.sql` | **Not applied** in production |
| Admin authentication | Supabase Auth user with `app_metadata.role === "admin"`; stateless HMAC session cookie `sb-access-token`, `HttpOnly`, `Max-Age=3600` | Already used by the existing admin area |
| Message listing | `GET /api/admin/messages?limit=&offset=` (limit capped at 100) | Implemented, auth-gated |
| Message deletion | `DELETE /api/admin/messages/:id` | Implemented, auth-gated, `404` when missing |
| Public support address | Optional `CONTACT_EMAIL` env/secret, syntax-validated, shown only when valid | Not configured — no email is hardcoded anywhere |

Operational note: the admin session has no refresh flow, so the operator re-logs in
roughly hourly. Acceptable for a private dashboard; documented so it is not mistaken
for a bug.

---

## 4. Migration review — `supabase/migrations/0003_contact.sql`

Reviewed, **not applied**.

- Additive only: `create table if not exists public.contact_messages` (identity PK,
  `created_at` default `now()`, the four visitor fields, nullable `ip_hash` /
  `user_agent`), one `create index if not exists` on `created_at desc`.
- No foreign keys, no `alter` of existing tables, no data backfill, no destructive
  statement. Safe to run on the existing production schema.
- Same conventions as `0001_admin.sql` (public schema, `if not exists`, RLS enabled).
- RLS enabled with **no policies**, matching the existing "browser never touches the
  DB, Worker uses the service-role key" model. The anon key cannot read messages.
- Idempotent: re-running is a no-op.
- Mirrored for local development in `d1/migrations/0003_contact.sql`.

Rollback, if ever needed: `drop table public.contact_messages;` (loses stored
messages only). Nothing else references the table.

---

## 5. Analytics and consent

Current state, as disclosed in `/privacy`:

- **GA4 (`G-G57VCHWGMX`)** loads for every visitor, including EEA/UK, with **no consent
  banner**. Under the ePrivacy Directive, analytics storage generally requires prior
  consent in the EEA/UK. The privacy page discloses the behaviour honestly; disclosure
  is not the same as consent.
- **Cloudflare Web Analytics** is injected by the Cloudflare zone (not by this
  repository). It is cookieless, aggregate and does not fingerprint, but it is still
  third-party measurement and is disclosed.
- **Ads are off.** No AdSense script, no ad cookies, no personalised advertising.

Before enabling AdSense (or any ad network) for EEA/UK traffic:

1. Integrate a **Google-certified CMP** (TCF v2) — AdSense requires one for EEA/UK
   traffic. This is a product/vendor decision; do not fake a consent gate.
2. Add a **"manage consent" / revoke** control that works after the first choice.
3. Update `/privacy` (and `/terms` if needed) to name the ad vendor, the cookie
   categories and the legal bases — before turning ads on, not after.
4. Verify the CMP does not break the existing CSP: `src/lib/csp.ts` widens the policy
   only while tracking/ads are configured. A hash-based policy makes browsers ignore
   `'unsafe-inline'`, so a CMP that needs inline script must be allow-listed explicitly.
5. Re-test GA4 consent mode: if analytics is gated, `bootstrapTracking()` must not load
   GA4 before consent.

Non-EEA-only launch is a business decision, not a compliance shortcut — geo-gating ads
does not remove the ePrivacy requirement for analytics.

---

## 6. Content review — 23 tool pages + 19 guides

Method: read-only audit of the live HTML (`scripts/audit-live-content.mjs` and a
one-off evidence extractor). Word counts measure `<main>` after removing `<script>`,
`<style>` and `<nav>` (related-link blocks repeat sibling page titles verbatim and would
otherwise create false positives). Near-duplication uses 6-gram Jaccard. Claim checks
mirror the site's own rules. Nothing was deleted, edited in the database, or set to
draft.

Headline numbers: **42 pages**, word counts **30–593**, **23 pages under 300 words**,
**2 pages without `FAQPage`**, **1 near-duplicate pair**, **13 claim-heuristic hits**
(most are disclaimers, see §6.4).

### 6.1 Pages that need a content decision (priority)

These are substantive problems, not just length. Each is a **DB row** — fix by editing
the draft and republishing, or set it to `draft` so it leaves the sitemap.

| Slug | Problem | Recommended action |
|---|---|---|
| `/how-to-download-instagram-reels-web-tool` | Promises Instagram Reels, but the resolver only allows `threads.net` / `threads.com`. The page cannot deliver what its title says. | Rewrite to Threads only, or set to `draft`. Do not keep an Instagram promise. |
| `/threads-video-length-limit-utility` | Describes a "length limit" feature that does not exist. | Rewrite around the real behaviour (source decides the file), or `draft`. |
| `/best-threads-video-downloader-online` | Self-superlative title/H1 ("best") — an unsupportable claim and a thin page. | Retitle/rewrite without the superlative, or `draft`. |
| `/threads-video-downloader-unlimited-access-utility` | "Unlimited" in slug and title; resolution is limited to 20/min. | Rewrite (remove "unlimited"), or `draft`. Slug change needs a redirect. |
| `/threads-video-download-without-watermark-tool` | "Without watermark" wording contradicts the site's own rule and the body text ("no watermark is added"). | Rewrite to "no watermark added", or `draft`. |
| `/blog/threads-video-download-without-watermark-guide` | Same wording problem in a guide. | Same rewrite, or `draft`. |
| `/threads-to-mp4-video-conversion-tool` | Implies transcoding to MP4; the tool only passes through the published file. | Rewrite as "save the published MP4", or `draft`. |
| `/blog/threads-to-mp4-conversion-guide` | Same implication. 456 words. | Same rewrite, or `draft`. |
| `/download-threads-video-in-1080p` | Promises 1080p; the post may not publish it. | Rewrite to "when the post publishes 1080p", or `draft`. |
| `/threads-photo-downloader` (DB row) | Collides with the registry route (`RESERVED_SLUGS`), so the DB row is unreachable and the page renders the registry copy instead. | Delete or rename the DB row; the registry page is now the real, long-form page. |
| `/threads-carousel-downloader` (DB row) | Same collision. | Same. |

### 6.2 Thin pages (under 300 words) — rewrite or consolidate

All of these are 185–256 words, mostly generic restatements of "paste a link and
download". None is harmful; at scale they look like low-value pages.

| Slug | Words | Note |
|---|---|---|
| `/threads-to-mp3-browser-tool` | 195 | overlaps the client-side MP3 feature page/guide |
| `/threads-to-mp4-video-conversion-tool` | 187 | see §6.1 |
| `/threads-video-downloader-web-utility` | 237 | generic |
| `/threads-video-save-browser-tool` | 218 | generic |
| `/how-to-download-threads-video-on-iphone-mobile-browser` | 256 | duplicate intent with the `-2` variant |
| `/how-to-download-threads-video-on-iphone-mobile-browser-2` | 213 | near-identical intent |
| `/how-to-download-instagram-reels-web-tool` | 210 | see §6.1 |
| `/threads-video-length-limit-utility` | 208 | see §6.1 |
| `/threads-video-downloader-unlimited-access-utility` | 210 | see §6.1 |
| `/download-threads-video-by-link-utility` | 211 | generic |
| `/threads-video-downloader-no-login` | 204 | generic; the "no login" point is already on the homepage |
| `/best-threads-video-downloader-online` | 218 | see §6.1 |
| `/save-threads-reels-video-tool` | 185 | generic |
| `/download-threads-video-in-1080p` | 216 | see §6.1 |
| `/threads-video-downloader-for-pc` | 234 | "PC" intent, no distinct behaviour |
| `/threads-video-downloader-free-browser-utility` | 206 | generic |
| `/threads-mp4-downloader-tool` | 200 | duplicates the MP4 intent |
| `/threads-video-download-without-watermark-tool` | 212 | see §6.1 |
| `/threads-video-downloader-hd` | 194 | duplicates HD/1080p intent |
| `/تنزيل-مقاطع-ثريدز` (Arabic) | 99 | very thin; also near-duplicate of the next row |
| `/تحميل-فيديو-ثريدز` (Arabic) | 121 | very thin; near-duplicate (Jaccard 0.15) |

Guidance: keep one page per **real** user intent (video, photo, carousel, GIF, profile
picture, iPhone, Android, HD/1080p-if-real, audio). Merge or draft the rest. The three
flagship pages now carry 600–780 words of unique copy and should be the internal-link
targets.

### 6.3 Duplicate-intent clusters

- **iPhone**: `how-to-download-threads-video-on-iphone-mobile-browser` and `…-2`.
  There is no dedicated `/threads-video-downloader-for-iphone` route (see §6.7), so at
  most one of these two rows should survive, rewritten around the real iOS save flow.
- **MP4**: `threads-to-mp4-video-conversion-tool`, `threads-mp4-downloader-tool`,
  `/blog/threads-to-mp4-conversion-guide`. One is enough.
- **MP3/audio**: `threads-to-mp3-browser-tool`,
  `/blog/threads-to-mp3-audio-conversion-tutorial`,
  `/blog/blog-extract-audio-from-threads-video`,
  `/blog/threads-video-to-mp3-audio-extraction-guide` (3 guides, 1 tool for one
  feature).
- **HD/1080p**: `/threads-video-downloader-hd`, `/download-threads-video-in-1080p`,
  `/blog/how-to-download-threads-videos-in-hd-complete-guide`.
- **"Generic downloader"**: `-web-utility`, `-save-browser-tool`,
  `-free-browser-utility`, `-by-link-utility`, `-no-login`. Mostly interchangeable.
- **Arabic pair**: the two rows above, Jaccard 0.15 — rewrite one into a distinct
  topic or merge.

### 6.4 Claim-heuristic hits that are **not** violations

Stated honestly so nobody "fixes" correct copy:

- "does not guarantee…" / "cannot guarantee…" — disclaimers, not promises.
- "best published quality" / "best available rendition" — describes the source file,
  not a ranking of the site.
- "which operating systems work best with this tool?" — a question, not a claim.
- "Summary of Best Practices for Media Archiving" — an article heading.
- Related-link titles such as "best threads video downloader…" were excluded by
  stripping `<nav>`; before that they produced false positives on every page linking
  to that row.

Genuine wording problems are the ones listed in §6.1 (watermark, unlimited, the
self-superlative title), plus these guides that need a read-through:

- `/blog/threads-video-downloader-online-without-registration-guide` — "unlimited",
  "guarantee", superlative.
- `/blog/how-to-download-threads-videos-in-hd-complete-guide` — "unlimited",
  "guarantee".
- `/blog/threads-video-to-mp3-audio-extraction-guide` — "unlimited", "guarantee",
  superlative.
- `/blog/download-threads-videos-without-an-app` — watermark wording.
- `/blog/blog-threads-photo-downloader-tutorial`,
  `/blog/blog-extract-audio-from-threads-video`,
  `/blog/blog-mastering-threads-video-downloader-usage` — guarantee / superlative
  wording.

### 6.5 Two live pages are shadowed (data, not code)

The production sitemap has 53 URLs, not 55: DB rows whose slug equals a registry route
(`threads-photo-downloader`, `threads-carousel-downloader`) are excluded from the
dynamic sitemap and are unreachable, because the Worker serves the registry page for
that path. That explains the 30- and 33-word pages in the audit: they are the current
short registry rendering, not the DB row. After the local changes are deployed, those
paths serve 600+ words; the orphan DB rows can then be removed.

### 6.6 What the audit does not establish

Word count and heuristics are proxies. They do not prove usefulness, accuracy of every
sentence, or search performance. The pages listed in §6.1 were read and are genuinely
wrong or unsupportable; the rest need the owner's judgement, not an automated rewrite.

### 6.7 Routes from the original brief that do not exist (pre-existing)

These five paths return a real `404` in production and are not in `SEO_ROUTES`:
`/threads-gif-downloader`, `/threads-profile-picture-downloader`,
`/threads-video-downloader-1080p`, `/threads-video-downloader-for-iphone`,
`/threads-video-downloader-for-android`. No header/footer/sitemap link points at them,
so there are no dead internal links — but if those landing pages are part of the
product plan, they still need to be written. This is unrelated to the trust-pages work
and was **not** changed here; the GIF/profile-picture features themselves are also not
claimed anywhere in the UI.

---

## 7. Deployment checklist (not executed)

### 7.1 Preflight (local, no production change)

```bash
git status                     # expect 19 modified + 14 untracked, nothing committed
npm test                       # 220 tests / 19 files
npx tsc --noEmit               # exit 0
npm run build                  # writes dist/client + dist/threads_video_downloader/wrangler.json
node scripts/audit-live-content.mjs --origin http://127.0.0.1:8788   # optional local content check
```

Review the diff before committing. `wrangler.jsonc` must still have
`"not_found_handling": "none"` and `"run_worker_first": true` on the assets binding
(reverting either brings back soft-404s or uncanonicalised static files).

### 7.2 Production database (required for the contact form)

```bash
npx supabase db push            # applies supabase/migrations/0003_contact.sql
```

Idempotent and additive. Without it the deployed form correctly shows "temporarily
unavailable" — no data loss, no fake success.

### 7.3 Optional public support address

```bash
npx wrangler secret put CONTACT_EMAIL     # must be a real, monitored mailbox
```

Nothing is hardcoded; if unset, the page simply does not show an address.

### 7.4 Deploy

```bash
npm run deploy                  # wrangler deploy
```

### 7.5 Post-deploy verification

```bash
BASE=https://www.savethreadsvideos.com

# Pages
for p in / /about /how-to-use /disclaimer /privacy /terms /contact \
         /faq /threads-video-downloader /threads-photo-downloader \
         /threads-carousel-downloader; do
  printf '%s ' "$p"; curl -sS -o /dev/null -w '%{http_code}\n' "$BASE$p"
done

# Contact API: accepting must be true after the migration
curl -sS "$BASE/api/contact"
# Health
curl -sS "$BASE/api/health"
# Sitemap + robots
curl -sS "$BASE/sitemap.xml" | grep -c '<loc>'
curl -sS "$BASE/robots.txt" | grep -i '^sitemap:'
# Real 404 and trailing-slash canonicalisation
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/this-page-does-not-exist"   # 404
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/about/"                     # 308
# HEAD support
curl -sS -I "$BASE/contact" | head -1
```

Then, manually:

1. Open `/contact`, submit one test message, confirm the "Message sent" state.
2. Log in at `/admin`, open Messages, confirm the row, delete it.
3. Confirm the form is **not** shown when `GET /api/contact` says
   `accepting:false` (temporarily point the local build at a DB without the table, or
   trust the local verification already recorded in §1).
4. Re-run Lighthouse on `/contact` and one tool page.
5. Check the three flagship tool pages render the long-form sections in **View
   Source** (not only after JS).
6. Confirm GA4 still receives a page view and the Cloudflare beacon still loads.
7. Confirm `/api/ads.json` still reports ads disabled unless you are enabling them.

### 7.6 Rollback

- **Code**: `npx wrangler rollback` (or redeploy the previous version id). Cloudflare
  keeps prior deployments; no data migration is involved.
- **Database**: the contact migration is additive; leaving the table in place is
  harmless. Drop it only if you deliberately abandon the feature.
- **Content**: DB pages are data, not code — reverting is `draft` or a normal edit, not
  a redeploy.

---

## 8. Remaining blockers and authorization gates

| Blocker | Owner of the action |
|---|---|
| `0003_contact.sql` not applied to production | Requires explicit authorization + `supabase db push` |
| Nothing committed or pushed; production runs the old version | Requires explicit authorization |
| Content fixes are DB rows (admin edit / draft), not code | Owner; no bulk action taken |
| Optional `CONTACT_EMAIL` unset | Owner (needs a real monitored mailbox) |
| GA4 has no consent gate for EEA/UK | Product decision; CMP required before ads |
| No CMP / consent-management control | Required before AdSense in EEA/UK |
| Messages are never emailed and have no retention automation | Operational obligation on the owner |
| AdSense not reviewed | Ads stay off until content review is done |
| Production Lighthouse, Search Console, real email round-trip | Not available from this machine |

Nothing above was worked around by faking behaviour: the form reports itself
unavailable, no email is invented, and no thin page was silently deleted or noindexed.

---

## 9. Reproduction

```bash
# tests + typecheck + build
npm test && npx tsc --noEmit && npm run build

# full runtime with the build output (no D1 -> contact correctly unavailable)
npx wrangler dev -c dist/threads_video_downloader/wrangler.json \
  --port 8788 --local --var MEDIA_RESOLVER_PROVIDER:mock

# live content audit (read-only, public pages only)
node scripts/audit-live-content.mjs
node scripts/audit-live-content.mjs --json
node scripts/audit-live-content.mjs --origin http://127.0.0.1:8788
```
