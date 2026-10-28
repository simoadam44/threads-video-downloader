# Trust pages + working contact form — AdSense readiness (27 October 2026)

Status: **implemented locally, verified locally, NOT deployed.** The canonical host
(`https://www.savethreadsvideos.com`), DNS, SSL settings and `canonicalHostRedirect`
were not touched.

This document records what changed, what the evidence is, what the site owner still
has to provide, and which items remain open before applying to AdSense.

> Follow-up (2026-10-28): `docs/production-readiness-2026-10-28.md` carries the
> refreshed verification numbers, the live content audit of the 23 tool pages and
> 19 guides, and the deployment/rollback checklist. Read it alongside this file.

---

## 1. Why this work was needed

An AdSense review rejects sites that look anonymous or machine-generated. Before this
change the site had:

| Page | Before |
|---|---|
| `/privacy` | 1 sentence |
| `/terms` | 1 sentence |
| `/contact` | 1 sentence + an unverified address (`contact@savethreadsvideos.com`) that was never confirmed to exist |
| `/about` | missing (footer "About Us" pointed at `/contact`) |
| `/disclaimer` | missing |
| `/how-to-use` | missing (nav "How to Use" pointed at `/how-to-download-threads-videos`) |
| Contact form | none |

Also missing: any statement of who operates the site, how data is actually handled,
what happens to a pasted link, and what a visitor can do if something breaks.

## 2. What was built

### 2.1 Shared content module (single source, no drift)

`src/lib/info-pages.ts` holds the full copy for `/about`, `/how-to-use`,
`/how-to-download-threads-videos` (rewritten), `/privacy`, `/terms`, `/disclaimer`
and `/contact`.

Both renderers consume the same blocks:

- React: `src/pages/info.tsx` (`InfoArticle`, `ContactPage`)
- Worker SSR: `src/server/content/render.ts` (`infoBlocksHtml`)

Before this, the server response for those routes was one sentence. It is now the
same multi-section article a human sees. Structured as `h2` → `h3` → `p` / `ul` / `ol`,
with a `Last updated: 27 October 2026` line on pages that change.

Content rules were encoded as tests (`tests/info-pages.test.ts`), not just review notes:
no invented email, phone, address, company, jurisdiction, support hours; no
"GDPR compliant" / "CCPA compliant" claims; no ratings, user counts, download counts;
no "unlimited", "#1", "watermark-free" or "removes watermarks" claims.

### 2.2 New and rewritten routes

| Route | State | Notes |
|---|---|---|
| `/about` | new | What the site is, who runs it (independent developer), design goals, privacy summary, corrections process |
| `/how-to-use` | new | Full walkthrough: public vs private posts, copying the right link, reading results, error-by-error troubleshooting, iPhone/Android/desktop notes |
| `/disclaimer` | new | Independence from Threads/Meta, no warranty, copyright responsibility, external links, no legal advice |
| `/privacy` | rewritten | Actual implementation: hashed resolve events, 5-minute metadata cache, streamed downloads, localStorage keys, GA4, contact form storage, retention, rights, no compliance certification |
| `/terms` | rewritten | Acceptable use, public content only, copyright responsibility, availability, liability, changes |
| `/contact` | rewritten | What to contact about, what is stored, no guaranteed response time, real form |
| `/how-to-download-threads-videos` | rewritten | Short quick guide that links to the full walkthrough |

All seven are in `SEO_ROUTES` (`src/lib/seo-routes.ts`) with a unique title,
description and H1, so they are automatically: canonicalised, in `/sitemap.xml`,
in the footer/nav, and pre-rendered with `BreadcrumbList` JSON-LD.

`/faq` gained 15 accurate Q/A entries (rendered into the initial HTML, plus
`FAQPage` JSON-LD) covering free use, quality, carousel, iPhone/Android, private
posts, where files are saved, what is stored, copyright and independence.

### 2.3 Real contact form (database inbox, not decoration)

No mail provider exists in this project, so the form does not pretend to email
anyone. It writes to the site database and the operator reads it in the admin area.

```
Browser form  →  POST /api/contact  →  contact_messages table  →  /admin/messages
```

- `GET /api/contact` returns `{ accepting, email }`. The React form calls it first and
  **hides the form** behind a clear notice when the inbox is not ready, instead of
  accepting messages nobody would read.
- `POST /api/contact`: JSON only (415 otherwise), 16 KB cap enforced on the body that was
  actually received, not just on the declared `Content-Length` (413), CSRF check via
  `Sec-Fetch-Site` (403 on cross-site), honeypot field (bot submissions answer `201`
  but store nothing), field-level validation with friendly messages, 3 messages per
  10 minutes per network (`429` + `Retry-After`).
- Stored: name, email, subject, message, salted SHA-256 hash of the IP, truncated
  User-Agent, timestamp. Never the raw IP. No cookies, no tracking payloads.
- `CONTACT_EMAIL` (optional env var/secret) is shown to visitors **only** when it is a
  syntactically valid address. No address is hardcoded anywhere.
- Admin: `GET /api/admin/messages` (paged) and `DELETE /api/admin/messages/:id`,
  plus a Messages page at `/admin/messages` with reply-by-email and delete.
- Validation rules live in `src/lib/contact-rules.ts` (client-safe); the Worker
  re-exports them from `src/server/contact.ts`, so the limits can never diverge.

Schema: `supabase/migrations/0003_contact.sql` and `d1/migrations/0003_contact.sql`
(table `contact_messages`, RLS locked down on Supabase).

### 2.4 Navigation and internal linking

- Footer: Product, Quick Links, Legal & Support, About (About, Disclaimers, Contact,
  Privacy, Terms, tool pages).
- Header nav: Home, How to Use, Features, FAQ, Blog.
- Each legal page ends with a "Related pages" block using real anchors (crawlable).
- Tool pages print a `summary` from `SEO_ROUTES` — the same string the SSR emits, so
  the hydrated page and the crawlable page cannot say different things.

### 2.5 Unchanged on purpose

- Ads stay **off** (`pubId: ""`, every slot `false`), all ad containers reserved but empty.
- Resolver, download tokens, rate limits, cache, canonical host and CSP behaviour untouched.
- GA4 (`G-G57VCHWGMX`) stays live — see §7.

## 3. What the copy claims, and where it comes from

Every factual statement in the privacy policy was checked against the code:

| Claim | Source |
|---|---|
| SHA-256 hash of the normalised URL, not the link | `resolve_events` insert in `src/server/worker.ts` |
| Salted hash of the IP, raw address not written | same |
| Status, media count, timestamp, User-Agent truncated to 256 chars | same / migration |
| Metadata cached ~5 minutes, in memory, per instance | `RESOLVE_CACHE_TTL` (300 s) `MemoryCache` |
| Downloads streamed through a ~5-minute opaque token, never stored | `handleDownload` + token TTL |
| Theme/language preferences in `localStorage` (`tvd-theme`, `tvd-lang`) | `src/components/chrome.tsx`, `src/i18n` |
| Admin session cookie HttpOnly, 1 hour | `src/server/auth` |
| GA4 is active, ads are not | live `/api/tracking.json` = `G-G57VCHWGMX`, `/api/ads.json` = `pubId:""` |
| No third-party resolver receives your link | default `OpenSourceResolver` runs in this Worker |

No claim of GDPR/CCPA compliance, "anonymisation", "we collect nothing", or a
company/jurisdiction is made, because none of that is verifiable from the code.

## 4. Verification evidence (local only)

Environment: production build served by `wrangler dev` on `http://127.0.0.1:8788`
with local D1 (migrations `0001`–`0003`) and mock resolver.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **220 tests / 19 files passed** (new: `tests/tool-content.test.ts` 5, `tests/info-pages.test.ts` 30, `tests/contact.test.ts` 16) |
| `npm run build` | passed — client `302.29 kB` (gzip `94.17 kB`), CSS `9.77 kB`, `static SEO: 53 sitemap URLs` |
| `/sitemap.xml` | 53 URLs = 13 static registry routes + 40 unique live DB entries; no `/api/`, no `/admin` |
| SSR of 13 routes | `200`, exactly one `<h1>`, unique `<title>`, apex canonical, PNG `og:image`, content in the initial HTML, no `noindex` |
| `HEAD` requests | `200` on `/about` and `/contact`, empty body |
| `/about/` | `308` to `/about` |
| unknown path | real `404` (not the homepage shell) |
| `/robots.txt` | `Sitemap:` line, `/api/` + `/admin/` disallowed, legal pages not blocked |
| Footer/related links | all present in server HTML |
| JSON-LD | `WebSite` everywhere; `BreadcrumbList` on info pages and the three flagship tool pages; `FAQPage` on `/faq` and those tool pages (only where the Q/A is visible in the HTML) |
| Contact `GET` | `accepting:true` with the migration applied; configured email exposed |
| Contact `POST` | `201` stored; invalid payload → `400` with `field`; missing table → `503 CONTACT_UNAVAILABLE` |
| Admin inbox | dev-token login `200`, message listed, `DELETE 200`, unauthenticated `401` |
| Browser E2E | typed into the real form on `/contact`, submitted, "Message sent" state, row visible via the admin API (hashed IP only) |
| Lighthouse (`/contact`, `/privacy`, `/about`, `/terms`) | **Accessibility 100, Best Practices 100, SEO 100** — no failures |
| Mobile layout (Chrome DevTools metrics) | 320 / 360 / 375 / 414 / 768 px: `scrollWidth == innerWidth` (no horizontal overflow) on `/`, `/contact`, `/privacy`; form button 44 px tall |

What is *not* verified: the production database (no access), production Lighthouse,
Search Console, and a real sender's email round-trip (there is no mail provider yet).

## 5. Owner input still required

Nothing below was invented in code; the pages are written to be accurate without it,
and only improve when it is supplied.

1. **Support email** — optional `CONTACT_EMAIL` secret. Until set, the only contact
   channel is the form (`/contact`), and the page says exactly that.
2. **Legal identity** — the pages say "an independent developer" and state no country,
   company or jurisdiction, because none was confirmed. If you want a legal entity,
   jurisdiction or postal address listed (some ad networks expect it), supply the exact
   wording; do not invent one.
3. **Copyright / takedown process** — the contact page routes rights complaints to the
   form. If you have a dedicated process or address, it can be added.
4. **Response expectation** — the copy says "no guaranteed response time". Change only
   if you can actually commit to one.

## 6. External services to configure

| Service | Required? | Action |
|---|---|---|
| Supabase (production DB) | **Yes, before the form works** | Apply `supabase/migrations/0003_contact.sql` (`supabase db push`). Without it the form shows "temporarily unavailable" (verified) — it never fakes a send. |
| `CONTACT_EMAIL` secret | Optional | `wrangler secret put CONTACT_EMAIL` (or a `vars` entry) so visitors can also email directly. Validated before display. |
| Mail provider | Optional | None is configured. Messages are only read at `/admin/messages`; there is no forwarding and no autoresponder. Adding one later means a new adapter, not a rewrite of the form. |
| GA4 | Already live | `G-G57VCHWGMX` via `/admin/seo-webmaster`. |
| Ads | Disabled | `pubId:""`; all six placements off. |

## 7. Remaining AdSense risks (honest list)

1. **No consent gate for GA4.** Analytics loads for every visitor, including EEA/UK.
   The privacy policy discloses this plainly. If you want to apply AdSense with EEA
   traffic, use a Google-certified CMP (AdSense requires one for EEA/UK traffic once
   ads are on) — that is a product decision, not something to fake in code.
2. **Existing DB content may be thin.** The sitemap currently contains 23 tool pages
   and 19 guides created through the admin/AI workflow. AdSense reviewers look for
   low-value pages at scale. The 2026-10-28 audit measured 23 pages under 300 words,
   one near-duplicate pair and a handful of unsupportable claims (Instagram, "length
   limit", "unlimited", "without watermark", 1080p) — the per-slug verdicts are in
   `docs/production-readiness-2026-10-28.md` §6. Review them before applying: keep the
   ones with real, distinct instructions; move weak ones to `draft` (they drop out of
   the sitemap automatically). They were **not** deleted or mass-edited here.
3. **No publisher identity beyond "independent developer."** That is truthful, but a
   reviewer may want a named operator. Your call.
4. **No ads to review yet.** Ads are off, so there is no ad layout to evaluate; the
   containers are CLS-safe and empty. Enable only after content review, and never
   inside the input, the result preview or next to the download button.
5. **The form requires JavaScript** (the article is server-rendered; the form is
   hydrated). Visitors with JS disabled can read `/contact` but cannot submit. Setting
   `CONTACT_EMAIL` mitigates this.
6. **No email delivery.** If nobody checks `/admin/messages`, messages go unanswered.
   That is an operational obligation, not a code issue.

## 8. Deploy checklist (not executed)

The full checklist — preflight, production migration, optional secret, deploy,
post-deploy HTTP/API checks and rollback — lives in
`docs/production-readiness-2026-10-28.md` §7. Short form:

```bash
# 1. production DB schema for the inbox (additive, idempotent)
npx supabase db push                    # applies 0003_contact.sql
# 2. optional public support address
npx wrangler secret put CONTACT_EMAIL
# 3. ship
npm test && npx tsc --noEmit && npm run build
npx wrangler deploy
```

Post-deploy checks (replace the host if it ever changes):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://www.savethreadsvideos.com/about
curl -sS https://www.savethreadsvideos.com/api/contact        # {"success":true,"data":{"accepting":true,...}}
curl -sS https://www.savethreadsvideos.com/sitemap.xml | grep -c '/about'
curl -sS https://www.savethreadsvideos.com/robots.txt
```

Then: submit one test message through the real form, log in to `/admin/messages`,
confirm the row and delete it. Re-run Lighthouse on `/contact`.

Rollback: `npx wrangler rollback` returns to the previous deployment (Cloudflare keeps
the versions). The contact migration is additive, so leaving the table in place is
harmless; drop `public.contact_messages` only if you abandon the feature.

## 9. Files touched

```
src/lib/info-pages.ts                     new: all legal / trust copy + quick guide
src/lib/tool-content.ts                   new: long-form copy for the 3 flagship tool pages
src/lib/contact-rules.ts                  new: shared validation (client + Worker)
src/lib/faq.ts                            rewritten: 15 accurate Q/A
src/lib/seo-routes.ts                     +/about, +/disclaimer, +/how-to-use, summaries
src/types.ts                              SeoRoute.summary
src/server/contact.ts                     new: re-export of the shared rules
src/server/worker.ts                      /api/contact, admin messages, RESERVED_SLUGS
src/server/db/{types,supabase,d1}.ts      contact message CRUD
src/server/content/render.ts              SSR of the blocks, breadcrumbs, header/footer
src/pages/info.tsx                        new: InfoArticle + ContactPage
src/components/contact-form.tsx           new: real form (probe, validation, honeypot)
src/pages/pages.tsx                       ToolPage/FaqPage/blog hub + summaries
src/pages/admin/admin.tsx                 AdminMessages
src/lib/admin-api.ts                      messages API
src/components/chrome.tsx                 footer/nav links
src/App.tsx                               routes
src/styles.css                            .prose, form, fields, honeypot
supabase/migrations/0003_contact.sql      inbox table
d1/migrations/0003_contact.sql            inbox table (local)
tests/info-pages.test.ts                  new: 30 tests
tests/contact.test.ts                     new: 16 tests
tests/tool-content.test.ts                new: 5 tests (substance, claims, pre-render)
scripts/audit-live-content.mjs            new: read-only thin/duplicate/claim audit
```

## 10. Reproduction (local)

```bash
npm run build
# temporary local D1 binding in wrangler.jsonc (remove before deploy)
npx wrangler d1 migrations apply threads-downloader-dev \
  -c dist/threads_video_downloader/wrangler.json --local --persist-to .wrangler/local-test
npx wrangler dev -c dist/threads_video_downloader/wrangler.json \
  --port 8788 --local --persist-to .wrangler/local-test \
  --var MEDIA_RESOLVER_PROVIDER:mock --var CONTACT_EMAIL:help@example.com
```

The verification script used for the table in §4 lives outside the repo at
`%TEMP%\opencode\verify-local.ps1`.
