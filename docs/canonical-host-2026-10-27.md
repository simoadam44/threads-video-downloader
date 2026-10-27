# Canonical host: `https://www.savethreadsvideos.com` (2026-10-27)

Goal: make the **www** host the single canonical origin and 301 every other
variant to it, without chains, loops or duplicate content.

## 1. Verified hosting architecture

| Item | Finding | How it was verified |
| --- | --- | --- |
| Platform | **Cloudflare Workers + Workers Static Assets** (not Pages, not another host) | `wrangler.jsonc` (`main: src/server/worker.ts`, `assets.directory: ./dist/client`), generated `dist/threads_video_downloader/wrangler.json`, deploy output |
| Worker | `threads-video-downloader` (account `a2cf8c46059a89fb2534486b47b6e05e`) | `npx wrangler deploy` output |
| DNS | Apex + `www` both **proxied** through Cloudflare; nameservers `harlee.ns.cloudflare.com` / `ridge.ns.cloudflare.com` | `Resolve-DnsName` → both resolve to Cloudflare anycast IPs (`104.21.75.206`, `172.67.181.251`) |
| TLS | Universal SSL covers apex + `www` (both serve HTTPS today) | `curl https://www...` and `https://...` both complete TLS handshakes |
| Redirect files | None (`_redirects`, `_headers`, `routes.json` absent — and Workers Static Assets does not support `_redirects` anyway) | repo scan |
| App-level redirect | None existed before this change | `canonicalHostRedirect` did not exist; both hosts returned `200` |

### Pre-existing (broken) edge behaviour

```
curl -I --max-redirs 0 http://www.savethreadsvideos.com/faq
→ 301 Location: https://www.savethreadsvideos.com/www     # path dropped, literal "/www"
```

Every path on `http://www.*` still landed on `.../www`, i.e. a **hardcoded
destination** rather than an expression that preserves the URL. This is a
zone-level Redirect Rule (or Page Rule), **not** something in this repository —
no Workers route/redirect config exists here, and the response carried no
Worker headers. It must be corrected in the dashboard (step 3).

**Resolved 2026-10-27**: the owner removed that rule, and live traffic now
returns `301 → https://www.savethreadsvideos.com/<original path>?<query>`.

`https://www.savethreadsvideos.com/*` currently serves the full site with
`200`, so **both hosts duplicate the site** today. Canonicals pointed at the
apex, which is the opposite of the requested canonical.

## 2. Implementation chosen

**Layer: the Worker** (`canonicalHostRedirect()` in `src/server/worker.ts`),
driven by the existing `SITE_URL` config var.

Why the Worker and not a dashboard Redirect Rule:

- It is version-controlled, testable (`tests/seo-audit.test.ts`) and reviewed by
  the normal deploy path; the zone already demonstrated dashboard drift (the
  `/www` bug), which a repo-level rule cannot suffer.
- No expression can silently lose the path: the target is built as
  `canonicalOrigin + url.pathname + url.search`.
- The canonical host comes from `SITE_URL`, so switching the preferred host again
  is a config change, not a code change.

Cost: `run_worker_first` had to become `true` (was `["/"]`). Otherwise the edge
served `/sitemap.xml`, `/robots.txt`, `/og-image.png` and `/assets/*` from the
apex host before the Worker could 301 them. Assets are still cached at the edge
and served through `env.ASSETS.fetch(req)`.

```
GET/HEAD  http(s)://savethreadsvideos.com/<path>?<query>
      301 → https://www.savethreadsvideos.com/<path>?<query>   (one hop)
GET/HEAD  http://www.savethreadsvideos.com/<path>?<query>
      301 → https://www.savethreadsvideos.com/<path>?<query>
GET/HEAD  https://www.savethreadsvideos.com/<path>?<query>
      200  (never redirected — loop guard)
```

Guard rails (unit-tested):

- Only the site's own apex + `www` hosts match; `*.workers.dev`, preview hosts,
  `localhost` and lookalikes (`savethreadsvideos.com.evil.example`) are untouched.
- The canonical HTTPS host is never redirected, so no loop is possible.
- Fail safe: if `SITE_URL` is unset (falls back to the request origin) or is not a
  distinct `www.` host, **nothing is redirected** — a self-redirect would loop.
- `POST`/`PUT`/etc. are never redirected (a 301 would rewrite POST → GET and
  break `/api/resolve`).

## 3. Cloudflare dashboard prerequisites (confirmed done 2026-10-27)

Wrangler's OAuth token has `zone:read` and Workers scopes but **no zone rules
write scope**, and it is expired (`API error 9109`), so these cannot be applied
from this repo. The site owner confirmed on 2026-10-27 that (1) and (2) below are
already satisfied; live probes corroborate it.

1. **Zone → Rules → Redirect Rules** (and, if empty, **Rules → Page Rules**):
   the rule that sent `http://www.savethreadsvideos.com/*` to the literal
   `https://www.savethreadsvideos.com/www` is **removed/disabled** — confirmed.
   Live check: `curl -I --max-redirs 0 http://www.savethreadsvideos.com/faq` now
   returns `301 → https://www.savethreadsvideos.com/faq` (no `/www`).
2. **No rule redirects `www` → apex** — confirmed. Live check:
   `curl -I --max-redirs 0 https://www.savethreadsvideos.com/faq` → `200`.
   This had to be true before deploying, otherwise apex → www (Worker) and
   www → apex (rule) would have formed a loop.
3. **SSL/TLS → Edge Certificates → Always Use HTTPS: keep ON.** It already 301s
   `http://*` → `https://*` with path + query preserved. Note: with it on, a
   plain-HTTP apex request takes two hops (http → https apex → https www). If
   single-hop is mandatory for HTTP, turn it **off** and let the Worker do both
   scheme + host in one 301 — but that removes the zone-wide safety net for other
   hostnames, so it is not the recommended default.
4. **SSL/TLS → Overview: mode must be `Full` or `Full (strict)`** (never `Flexible`
   — a Flexible mode is the classic cause of HTTPS redirect loops with Workers).
5. Leave DNS and nameservers untouched. Both hostnames are already proxied.

## 4. Deploy (done)

Dashboard prerequisites were confirmed by the site owner on 2026-10-27:
(a) the rule sending `http://www…/*` to the literal `/www` destination is
removed/disabled, and (b) no rule redirects `www` → apex. Live probes agree
(`http://www…/faq` → `301 https://www.savethreadsvideos.com/faq`, `https://www…/faq` → `200`).

```
npm test        # 169 passed / 16 files
npm run build   # pass; generated config: run_worker_first=true, SITE_URL=https://www…
npx wrangler deploy
```

Deployed **2026-10-27**, Worker `threads-video-downloader`,
**Version ID `095ba9e1-f43d-4873-84c6-9c36e36b52e5`**.
Binding: `env.SITE_URL ("https://www.savethreadsvideos.com")`.

## 5. Verification matrix (run in production after deploy — all passing)

| # | Command | Result |
| --- | --- | --- |
| 1 | `curl -sI --max-redirs 0 http://savethreadsvideos.com/` | `301` → `https://savethreadsvideos.com/` (Always Use HTTPS), then `301` → `https://www.savethreadsvideos.com/` — 2 hops, final `200` |
| 2 | `curl -sI --max-redirs 0 https://savethreadsvideos.com/` | `301`, `Location: https://www.savethreadsvideos.com/` — **1 hop** |
| 3 | `curl -sI --max-redirs 0 http://www.savethreadsvideos.com/` | `301`, `Location: https://www.savethreadsvideos.com/` — **1 hop**, no `/www` |
| 4 | `curl -sI https://www.savethreadsvideos.com/` | `200`, no `Location` |
| 5 | `… https://savethreadsvideos.com/faq` | `301` → `https://www.savethreadsvideos.com/faq` |
| 6 | `… https://savethreadsvideos.com/blog/how-to-download-threads-videos-in-hd-complete-guide` | `301` → same path on www (nested path preserved) |
| 7 | `… 'https://savethreadsvideos.com/?utm_source=test&utm_medium=email'` | `301` → `https://www.savethreadsvideos.com/?utm_source=test&utm_medium=email` (query preserved) |
| 8 | `… https://savethreadsvideos.com/nope-does-not-exist` + `-L` | 1 redirect, final `404` on www (path preserved, real 404) |
| 9 | hops: https apex / http www / https www / http apex | `1` / `1` / `0` / `2`, every chain ends `200` — no loop |
| 10 | `… https://savethreadsvideos.com/sitemap.xml`, `/robots.txt`, `/og-image.png`, `/favicon.svg`, `/assets/*.js` | all `301` → same path on www (this is why `run_worker_first: true`) |
| 11 | `/`, `/faq`, `/threads-photo-downloader`, `/privacy`, `/terms`, `/contact`, `/blog`, `/blog/<slug>` | `200`; canonical + `og:url` + `og:image` on `https://www…`; 1 `<h1>`; JSON-LD present; `og:type` website / article correct |
| 12 | `/sitemap.xml` | `50` `<loc>`, **50 on www, 0 apex**, `42` `<lastmod>` |
| 13 | `/robots.txt` | `Sitemap: https://www.savethreadsvideos.com/sitemap.xml` |
| 14 | `/api/health` | `200` `{"ok":true,"resolver":"opensource"}` |
| 15 | `/assets/index-*.js` on www | `200`, `text/javascript`, 244185 bytes (assets still served via `env.ASSETS`) |
| 16 | `/admin/login` | `200`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, strict hash CSP |
| 17 | `POST /api/resolve` on **apex** with an invalid URL | `400 UNSUPPORTED_URL` — not 301-rewritten (POST guard works) |
| 18 | `GET /faq/` on www | `308` → `/faq` (duplicate-URL protection intact) |

## 6. SEO changes made with this switch

- `SITE_URL` (Worker var + `.env.example` + `src/lib/site.ts` fallback) → `https://www.savethreadsvideos.com`.
- `index.html`: canonical, `og:url`, `og:image`, `twitter:image` → www.
- Server-rendered canonicals / OG / Twitter / JSON-LD follow `SITE_URL`, so they
  switched automatically (verified locally: `/`, `/faq`).
- Sitemap + `robots.txt` `Sitemap:` directive → www (dynamic Worker output and
  the build-time copies in `dist/client/` both verified).
- Bug fixed: `scripts/gen-static-seo.mjs` called `JSON.parse()` on
  `wrangler.jsonc` (which contains `//` comments), so it always threw and fell
  back to a hardcoded host — the static sitemap ignored `SITE_URL` entirely. It
  now strips whole-line comments (`readSiteUrlFromConfig`).
- No page path, content, DNS record, or application feature was changed.

## 7. Rollback

Revert `SITE_URL` to the desired host and redeploy; the redirect direction follows
config automatically. If the Worker must not redirect at all, set `SITE_URL` to a
non-`www` value (the guard then disables redirection) or remove the
`canonicalHostRedirect` call.

## 8. Remaining manual SEO steps (outside this repo)

Search engines must be told the canonical host changed. Nothing here can be done
from the codebase:

1. **Google Search Console** — the `www` property
   (`https://www.savethreadsvideos.com/`) must exist and be verified; then submit
   `https://www.savethreadsvideos.com/sitemap.xml`. If only the apex property is
   verified, use **Settings → Change of address** to point it at the `www`
   property (this tool is only available when both properties are verified and
   both serve the site).
2. **Bing Webmaster Tools** — add/re-verify the `www` host and submit the same
   sitemap.
3. Expect temporary volatility: the apex URLs now 301, so previously indexed apex
   URLs will be consolidated into the `www` URLs over the following weeks. The
   canonical tags already point at `www`, which is the important signal.

## 9. Known limitations

- Plain-HTTP apex requests take **2 hops** (`http → https apex → https www`)
  while Cloudflare **Always Use HTTPS** is ON. Single-hop for that one variant
  would require disabling that zone-wide setting; not worth the trade-off.
- The redirect is implemented in the Worker, so it costs one Worker invocation
  per request (including static assets) because of `run_worker_first: true`.
  Assets remain edge-cached and are served unchanged.
- `wrangler dev` (Miniflare) rewrites a `Location` whose host equals the request
  host back to the dev protocol, so locally `http://www…` appears to redirect to
  `http://www…`. Production and unit tests emit `https`.
- Zone rules still cannot be inspected from this repo (Wrangler OAuth token
  expired / no zone-rules scope). Any future dashboard rule touching these hosts
  must be re-checked against this document.
