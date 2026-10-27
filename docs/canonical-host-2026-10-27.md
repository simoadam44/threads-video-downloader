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

## 3. Manual Cloudflare dashboard steps (cannot be done via the deploy token)

Wrangler's OAuth token has `zone:read` and Workers scopes but **no zone rules
write scope**, and it is currently expired (`API error 9109`), so these must be
done in the dashboard. Nothing below has been applied.

1. **Zone → Rules → Redirect Rules** (and, if empty, **Rules → Page Rules**):
   locate the rule that sends `http://www.savethreadsvideos.com/*` to the literal
   `https://www.savethreadsvideos.com/www` and **delete it**. Confirm first with:
   `curl -I --max-redirs 0 http://www.savethreadsvideos.com/faq`
   (after the fix it must no longer return `/www`).
2. Confirm **no rule redirects `www` → apex** (`https://www.*` must stay 200).
   If such a rule exists, deleting it is mandatory *before* deploying this
   Worker, otherwise apex → www (Worker) and www → apex (rule) form a loop.
   Check: `curl -I --max-redirs 0 https://www.savethreadsvideos.com/faq` → expect `200`.
3. **SSL/TLS → Edge Certificates → Always Use HTTPS: keep ON.** It already 301s
   `http://*` → `https://*` with path + query preserved. Note: with it on, a
   plain-HTTP apex request takes two hops (http → https apex → https www). If
   single-hop is mandatory for HTTP, turn it **off** and let the Worker do both
   scheme + host in one 301 — but that removes the zone-wide safety net for other
   hostnames, so it is not the recommended default.
4. **SSL/TLS → Overview: mode must be `Full` or `Full (strict)`** (never `Flexible`
   — a Flexible mode is the classic cause of HTTPS redirect loops with Workers).
5. Leave DNS and nameservers untouched. Both hostnames are already proxied.

## 4. Deploy order (only after steps 1–2)

```
npm test && npm run build && npx wrangler deploy
```

## 5. Verification matrix (run after deploy)

Expected results — none of this has been verified in production yet, because the
change is not deployed:

| # | Command | Expected |
| --- | --- | --- |
| 1 | `curl -sI --max-redirs 0 http://savethreadsvideos.com/` | `301`, `Location: https://www.savethreadsvideos.com/` (or 301 → https apex if AUH fires first: still resolves to www) |
| 2 | `curl -sI --max-redirs 0 https://savethreadsvideos.com/` | `301`, `Location: https://www.savethreadsvideos.com/` |
| 3 | `curl -sI --max-redirs 0 http://www.savethreadsvideos.com/` | `301`, `Location: https://www.savethreadsvideos.com/` |
| 4 | `curl -sI https://www.savethreadsvideos.com/` | `200` (no `Location`) |
| 5 | `curl -sI --max-redirs 0 https://savethreadsvideos.com/blog/example/` | `301` → `https://www.savethreadsvideos.com/blog/example/` (trailing slash kept) |
| 6 | `curl -sI --max-redirs 0 'https://savethreadsvideos.com/?utm_source=test'` | `301` → `https://www.savethreadsvideos.com/?utm_source=test` |
| 7 | `curl -sIL https://savethreadsvideos.com/faq` + `grep -c ^HTTP` | `1` hop after AUH, i.e. no loop, final `200` |
| 8 | `curl -s https://www.savethreadsvideos.com/ \| grep canonical` | `https://www.savethreadsvideos.com/` |
| 9 | `curl -s https://www.savethreadsvideos.com/sitemap.xml \| grep -c '<loc>https://www'` | all entries (50) on `www`, zero apex |
| 10 | `curl -s https://www.savethreadsvideos.com/robots.txt` | `Sitemap: https://www.savethreadsvideos.com/sitemap.xml` |

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
