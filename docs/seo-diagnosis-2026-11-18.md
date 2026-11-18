# SEO diagnosis: the 2026-10-25 ranking collapse (2026-11-18)

Evidence base: the Search Console export `savethreadsvideos.com-Performance-on-Search-2026-11-18.xlsx`
(40 days, 2026-10-08 → 2026-11-16) plus a fresh read of the live HTML and the repository code.
All numbers below are computed from that export, not estimated.

---

## 1. What happened, in one table

| Segment | Days | Clicks | Impressions | CTR | Avg. position |
|---|---|---|---|---|---|
| 2026-10-09 → 10-24 | 17 | 531 | 25,915 | 2.05% | 7.6 |
| 2026-10-25 → 11-16 | 23 | 44 | 577 | 7.63% | 51.3 |
| Change | — | **−92%** (31.2 → 1.9 /day) | **−98%** (1,524 → 25 /day) | +5.6 pts | **+43.7** |

Daily shape:

| Date | Impressions | Position |
|---|---|---|
| 10-22 | 1,914 | 7.3 |
| 10-23 | 1,803 | 7.7 |
| 10-24 | 1,486 | 7.6 |
| **10-25** | **22** | 28.0 |
| 10-26 | 16 | 36.1 |
| 10-27 | 12 | 42.7 |
| 11-06 | 58 | 59.4 |
| 11-09 | 29 | 62.1 |

A 98.5% fall between two consecutive days, with the average position deteriorating from 7.6 to
the 40s–60s over the following three weeks, is not organic decay and not a crawl outage.
It is the signature of a **site-level demotion**: Google still returns the pages, but far lower,
and only for the query set where it still has any relevance signal.

That CTR *rose* in the after segment is not good news — it is survivorship. The only
impressions left are queries where the site already sits in positions 1–5 (mostly brand and
long-tail), so the ratio improves while volume collapses.

## 2. Scope: this was not a page-level accident

| Page | Clicks | Impressions | Share of impressions |
|---|---|---|---|
| `https://www.savethreadsvideos.com/` | 546 | 24,886 | 94% |
| `http://savethreadsvideos.com/` | 19 | 791 | 3.0% |
| `https://savethreadsvideos.com/` | 2 | 92 | 0.3% |
| Arabic DB page `/تحميل-فيديو-ثريدز` | 5 | 404 | 1.5% |
| every other page (15 URLs) | 3 | ~319 | ~1.2% |

- The homepage (all host variants) carried **97.3%** of impressions and **98.7%** of clicks.
- The 42 admin-created DB pages (23 tools + 19 guides) produced a combined ~250 impressions
  over 40 days. Most saw 0–10.
- One query cluster drove a quarter of everything: `threads video download` alone =
  6,028 impressions, 74 clicks, 1.2% CTR, position 8.1.

Consequence: there was no diversified organic footprint to absorb a shock. Any site-level
re-evaluation hits 100% of the traffic at once, which is exactly what the data shows.

## 3. Defects found in the code and the live HTML

These are real, reproducible, and were live during the crawl window that preceded the collapse.

### 3.1 Soft-404 duplication (live from launch until 2026-10-27)

`wrangler.jsonc` had `not_found_handling` at its default SPA behaviour and the Worker was not
guaranteed to see navigations, so **every unknown path returned the homepage shell with HTTP 200**.
`/faq`, `/privacy`, `/blog` and thousands of random paths all returned the same 200 HTML.
That is unbounded duplicate content served to the crawler on a brand-new domain, and it is the
single worst technical signal the site emitted. Fixed in `2babf34` (2026-10-27) with
`not_found_handling: none` + `run_worker_first: true`. Google needs weeks to re-crawl and
re-evaluate that; the fix is correct but the damage is not undone by the commit.

### 3.2 Four host variants indexed as separate URLs

The Pages report lists `https://www…`, `http://savethreadsvideos.com/` (791 impressions) and
`https://savethreadsvideos.com/` (92) as distinct pages. Canonicals pointed at `www` while `www`
301-redirected to the apex. Split signals on a new domain, during the exact period Google was
deciding what this site is. Fixed in `36a1037` (apex → `www` 301), again after the collapse.

### 3.3 The page that ranked has almost no content

Live HTML of `/` on 2026-11-18:

| Metric | Value |
|---|---|
| HTML size | 4,528 bytes |
| Words inside `<main>` | **33** |
| `<h2>` elements | **0** |
| FAQ in the HTML | none |
| JSON-LD | `WebSite` only (no `WebApplication`, no `FAQPage`) |

Compare `/threads-video-downloader` (735 words, 6 `h2`, `FAQPage` + `BreadcrumbList`) and
`/faq` (731 words, 16 Q&A). The homepage won positions 6–8 on title/domain match alone.
The moment a quality threshold was applied, there was nothing behind the page to hold it —
no depth, no entity coverage, no structured data describing the tool.

### 3.4 Scaled, templated, keyword-stuffed DB content

42 pages were created through the admin AI drafting flow in the first days of the site
(2026-10-06/07). A read-only audit (`node scripts/audit-live-content.mjs`) counted 23 of 42
under 300 words in `<main>`, plus at least one near-duplicate pair. URL slugs are
keyword permutations rather than distinct intents:

- `/best-threads-video-downloader-online`
- `/threads-video-downloader-free-browser-utility`
- `/threads-video-downloader-hd`
- `/threads-video-save-browser-tool`
- `/threads-mp4-downloader-tool`

This is the exact pattern the September 2026 spam update (Google-confirmed, 2026-09-24 → 10-08)
was reported to target: highly templated, likely AI-generated pages produced at scale. The
update completed 17 days before the collapse; classifier effects commonly land on later
crawl/recompute cycles, and third-party trackers reported heavy unconfirmed volatility on
**2026-10-24** — the day before the cliff.

### 3.5 Reserved-slug collision makes two flagship pages unreachable

The DB rows for `threads-photo-downloader` and `threads-carousel-downloader` are shadowed by
`RESERVED_SLUGS`, so those two rows can never be served (this is why the sitemap has 53 URLs,
not 55). Two of the three headline products exist twice in the system, and one copy of each is
dead weight in the index.

### 3.6 Five advertised routes 404

`/threads-gif-downloader`, `/threads-profile-picture-downloader`,
`/threads-video-downloader-1080p`, `/threads-video-downloader-for-iphone`,
`/threads-video-downloader-for-android` return 404 and are not linked anywhere. They are not
indexed, so they did not cause the drop — but they are product gaps, not defects to hide.

### 3.7 Thin internal linking

Navigation and footer only. No contextual links between the homepage and the three tool pages,
no hub structure, and the 33-word homepage gives the crawler no reason to visit anything else.
With 97% of visibility on `/`, the rest of the site was effectively unlinked from the page
Google actually crawled.

## 4. Ranked causes (confidence)

| # | Cause | Confidence | Why |
|---|---|---|---|
| 1 | Site-level quality/spam demotion applied to the whole domain | **High** | One-day cliff, uniform position loss, no deindexing, homepage-driven, timing after the Sept spam update + Oct 24 volatility |
| 2 | Soft-404 duplication on an unbounded URL space until 2026-10-27 | **High** (defect confirmed) / Medium (as trigger) | Confirmed live behaviour; classic duplication and crawl-budget signal |
| 3 | Scaled AI-generated templated pages (23 under 300 words) | **High** (defect) / Medium (as trigger) | Matches the documented target profile of the Sept 2026 spam update |
| 4 | Homepage with 33 words, 0 `h2`, no FAQ, no `WebApplication` schema | **High** (defect) | The one page with all the visibility has no content depth to defend it |
| 5 | Host/canonical split (`www` vs apex vs `http`) | Medium | Three homepage URLs received impressions during the evaluation window |
| 6 | New domain, no link equity, no brand demand, single-query dependency | Medium | Launch 2026-10-05, ~6 weeks old, no backlinks, 25% of impressions from one query |
| 7 | Keyword cannibalisation between homepage and the `…-video-downloader-*` DB slugs | Low–Medium | Little evidence in this export; those pages received almost no impressions |

## 5. What is *not* the cause

Do not spend time here:

- **The 2026-10-27 canonical-host deploy.** It shipped two days *after* the cliff (10-25) and
  the site kept serving 200s throughout. It improved the situation; it did not cause it.
- **Server downtime, 5xx or DNS.** No crawl interruption appears in the data.
- **Deindexing.** Impressions continue daily; the site is ranked low, not removed.
- **The November 2026 core update (started 2026-11-10).** It began 16 days after the drop.
  It may still move the site (rollout to ~11-24), which is why changes made now must be
  annotated so the effect can be separated.
- **Ads/analytics.** AdSense is disabled and GA4 has no consent gate — a legal/UX issue,
  not a ranking factor.
- **Missing `hreflang`.** Language switching happens at the same URL, so there is no duplicate
  pair to declare. (Real `/fr/` and `/ar/` URLs would be an SEO improvement, not a fix.)

## 6. Recovery plan

Ordered by leverage per hour of work. Items marked **[code]** can be done in this repository;
items marked **[owner]** need Search Console or admin access.

### P0 — before touching anything (verify the hypothesis)

1. **[owner]** Search Console → *Manual actions*: look for "Scaled content abuse",
   "Thin content with little or no added value", "Site reputation abuse". A manual action
   changes the plan completely: fix, then file a reconsideration request.
2. **[owner]** Search Console → *Security issues*: confirm nothing is flagged.
3. **[owner]** Crawl stats, 2026-10-18 → 2026-10-28: look for a crawl spike on garbage URLs
   (the soft-404s) and for 5xx/403/timeouts.
4. **[owner]** Page indexing: count *Duplicate without user-selected canonical*,
   *Soft 404*, *Crawled – currently not indexed*. These categories should read near zero now.
5. **[owner]** URL inspection on `/` and on `/threads-video-downloader`: confirm the indexed
   canonical is `https://www.savethreadsvideos.com/…` and the render is complete.

### P1 — technical and consolidation **[code]**

6. Expand the server-rendered homepage from 33 words to 700–1,000 words with real `h2`
   sections (what it does, supported link formats, video/photo/carousel, quality, privacy,
   limitations), a visible FAQ, and `WebApplication` + `FAQPage` JSON-LD in `src/server/content/render.ts`.
   Content must live in a shared module so React and SSR cannot drift (same pattern as
   `src/lib/tool-content.ts`).
7. Make the homepage link out contextually to the three tool pages, the how-to guide and the FAQ —
   real anchor text inside body copy, not just nav.
8. Retire or merge the keyword-permutation slugs: keep one page per real intent
   (`video`, `photo`, `carousel`, `gif`, `profile picture`, `how-to`, `faq`), draft the rest
   through the admin UI. Do **not** delete in bulk and do **not** mass-noindex — 301 the
   genuinely duplicative ones to the surviving page, and leave the rest as drafts.
9. Fix the reserved-slug collision so the photo/carousel DB rows cannot shadow the static routes.
10. Decide the five 404 routes: implement `/threads-gif-downloader` and
    `/threads-profile-picture-downloader` only if the resolver can honour them; otherwise leave
    them absent and keep them out of navigation and the sitemap.
11. Rewrite the remaining DB titles/descriptions that are keyword strings rather than sentences;
    remove any claim the product cannot keep ("unlimited", "without watermark", "1080p guaranteed").
12. Resubmit `/sitemap.xml` and request indexing for `/`, the three tool pages, `/how-to-download-threads-videos`, `/faq`.

### P2 — content quality

13. Make the three tool pages genuinely different products in prose: different inputs,
    different outputs, different screenshots, different troubleshooting. Today they are the same
    tool with three titles.
14. Add the honest limitations to the homepage copy: private accounts unsupported, availability
    depends on what the public post exposes, download quality is whatever the post publishes.
15. Give every page one clear search intent and one canonical target. No page should compete
    with `/` for "threads video download".

### P3 — authority

16. Earn 5–15 real citations: product directories, a couple of genuine tool round-ups, a
    GitHub README, relevant forum answers where the tool actually answers the question.
    No purchased links, no PBNs, no link exchanges at scale.
17. Build brand demand. "savethreads" already produced 372 impressions organically; that is the
    one asset a demotion cannot take away. Keep the name identical everywhere.
18. Keep publishing at a human pace: one genuinely useful article at a time, not batches.

### P4 — measurement

19. Annotate 2026-10-25 and 2026-10-27 in Search Console / analytics.
20. Weekly: clicks, impressions, average position for the top 20 queries; homepage vs tool pages.
21. Re-run `node scripts/audit-live-content.mjs` after any content change; word counts,
    near-duplicates and claim rules must stay clean.
22. Judge nothing before the November core update finishes (≈2026-11-24).

## 7. What recovery realistically looks like

| Fix | First signal | Full effect |
|---|---|---|
| Technical (soft-404s, canonical, sitemap) | 2–4 weeks (re-crawl) | 4–8 weeks |
| Homepage depth + internal links | 3–6 weeks | 2–3 months |
| Content consolidation | next crawl cycle per URL | 1–3 months |
| Algorithmic demotion reversal | next spam/core update after the fixes are crawled | 1–6 months, not guaranteed |
| Manual action (if one exists) | ~2–4 weeks after an approved reconsideration | same |

Returning to the 2026-10-19 peak (≈2,900 impressions/day) within weeks is not a realistic
target. A ~6-week-old domain with no backlinks was ranking on a thin single page; the honest
target is a stable position 5–10 on the core `threads video download` cluster with a diversified
page footprint, then growth from there.

## 8. Do not do

- Do not mass-delete or bulk-noindex the 42 DB pages in one action.
- Do not generate 42 more AI pages to "replace" the thin ones.
- Do not change DNS, nameservers, SSL mode or `canonicalHostRedirect` while diagnosing.
- Do not disavow links that were never built.
- Do not remove GA4 or ads hoping for a ranking effect.
- Do not apply `supabase/migrations/0003_contact.sql` as an SEO measure — it fixes the contact
  form, nothing else.
