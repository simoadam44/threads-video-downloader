# Threads Video Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MVP Threads Video Downloader matching screenshot (light minimal) on Cloudflare Workers.

**Architecture:** SPA + build-time prerender per SEO route + single Worker serving assets, API, sitemap, robots. Mock resolver + stubbed external resolver, server-only secrets.

**Tech Stack:** React 18, Vite 6, TypeScript strict, React Router 6, @cloudflare/vite-plugin, Wrangler, Vitest.

**Spec:** AGENTS.md in repo root + approved screenshot design (light minimal, black buttons, sections: header/hero/trust/how-to/formats/why/FAQ/CTA/footer).

## Global Constraints

- Runtime is Cloudflare Workers: Web APIs only (fetch/Request/Response/URL/Headers/ReadableStream/AbortController/Web Crypto), no fs/child_process/net.
- Never `await response.arrayBuffer()` / `blob()` for large media; direct safe URLs only.
- No `/api/download?url=ANY_URL` open proxy; SSRF allowlist `threads.net, threads.com` only.
- Never expose `MEDIA_RESOLVER_API_KEY` to client; no secrets in git.
- No fake stats/ratings/reviews; independent third-party disclaimer in footer.
- Light-first UI matching screenshot; `dir=rtl` for Arabic.
- SITE_URL placeholder: `https://threads-video-downloader.example.com`.

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `index.html`, `.env.example`, `.gitignore`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: none
- Produces: npm scripts `dev/build/preview/deploy`, Worker entry `src/server/worker.ts`

- [ ] **Step 1: Write failing smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("boots", () => { expect(true).toBe(true); });
});
```

- [ ] **Step 2: Scaffold vite + deps**

Run: `npm create vite@latest . -- --template react-ts` (accept overwrite of empty dir), then `npm i react-router-dom` and `npm i -D @cloudflare/vite-plugin wrangler vitest`.
Expected: `package.json` exists with scripts.

- [ ] **Step 3: Write configs**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({ plugins: [react(), cloudflare()] });
```

`wrangler.jsonc`:
```jsonc
{
  "name": "threads-video-downloader",
  "compatibility_date": "2026-10-05",
  "main": "src/server/worker.ts",
  "assets": { "directory": "./dist/client", "not_found_handling": "single-page-application" }
}
```

`package.json` scripts: `"dev": "vite", "build": "tsc --noEmit && vite build && node scripts/prerender.mjs", "preview": "vite preview", "deploy": "wrangler deploy", "test": "vitest run"`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/smoke.test.ts`
Expected: PASS

### Task 2: Shared core (types, SEO registry, filenames, i18n)

**Files:**
- Create: `src/types.ts`, `src/lib/seo-routes.ts`, `src/lib/site.ts`, `src/lib/filenames.ts`, `src/lib/api.ts`, `src/i18n/en.json`, `src/i18n/fr.json`, `src/i18n/ar.json`
- Test: `tests/filenames.test.ts`, `tests/seo.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `ResolvedPost`, `MediaItem`, `SEO_ROUTES: SeoRoute[]`, `safeFilename(parts): string`, `SITE_URL`

- [ ] **Step 1: Write failing tests**

```ts
// tests/filenames.test.ts
import { describe, it, expect } from "vitest";
import { mediaFilename } from "../src/lib/filenames";
describe("mediaFilename", () => {
  it("builds safe video name", () => {
    expect(mediaFilename("video", "abc123", 0, "mp4")).toBe("threads-video-abc123.mp4");
  });
  it("strips traversal", () => {
    expect(mediaFilename("video", "../x", 0, "mp4")).toBe("threads-video-x.mp4");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/filenames.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

`src/types.ts`: `MediaType`, `MediaItem`, `ResolvedPost`, `ApiErrorCode` union, `ResolveSuccess`, `ResolveFailure`.
`src/lib/seo-routes.ts`: export `SEO_ROUTES` array of `{ path, title, description, h1 }` for `/`, `/threads-video-downloader`, `/threads-photo-downloader`, `/threads-carousel-downloader`, `/how-to-download-threads-videos`, `/faq`, `/privacy`, `/terms`, `/contact`, `/blog` + `canonicalFor(path)` using `SITE_URL`.
`src/lib/filenames.ts`: sanitize `[^a-zA-Z0-9-_]` → strip, build names per spec.
`src/i18n/*.json`: `{ hero: { badge, title, subtitle, placeholder, button, trust }, ... }` minimal EN, FR, AR mirrors.

- [ ] **Step 4: Run tests PASS**

Run: `npx vitest run tests/filenames.test.ts tests/seo.test.ts`

### Task 3: Server (validate, resolvers, services, worker)

**Files:**
- Create: `src/server/validate.ts`, `src/server/resolvers/types.ts`, `src/server/resolvers/mock.ts`, `src/server/resolvers/external.ts`, `src/server/resolvers/index.ts`, `src/server/services/cache.ts`, `src/server/services/rate-limit.ts`, `src/server/worker.ts`
- Test: `tests/validate.test.ts`, `tests/resolver.test.ts`

**Interfaces:**
- Consumes: `ResolvedPost` from Task 2
- Produces: `validateThreadsUrl(input): { ok, url?, code? }`, `getResolver(env): MediaResolverProvider`, Worker `fetch(request, env)`

- [ ] **Step 1: Write failing tests**

```ts
// tests/validate.test.ts (excerpt)
import { describe, it, expect } from "vitest";
import { validateThreadsUrl, extractThreadsUrl } from "../src/server/validate";
describe("validate", () => {
  it("accepts threads.net post", () => {
    const r = validateThreadsUrl("https://www.threads.net/@user/post/abc123");
    expect(r.ok).toBe(true);
  });
  it("rejects javascript:", () => {
    expect(validateThreadsUrl("javascript:alert(1)").ok).toBe(false);
  });
  it("extracts embedded url", () => {
    expect(extractThreadsUrl("check this https://www.threads.com/@u/post/x out")).toContain("threads.com");
  });
});
```

- [ ] **Step 2: Run FAIL**, then implement `validate.ts` (URL parse, protocol https only, hostname allowlist `threads.net/threads.com/www./*.threads.net`, block localhost/private, normalize: lowercase host, strip utm params, `extractThreadsUrl` regex `https?://[^\s"']*threads\.(net|com)[^\s"']*`).
- [ ] **Step 3: Implement resolvers**: `mock.ts` returns fixtures (url contains `carousel` → 5 items; `photo`/`image` → 1 image 1080x1350 picsum; else 1 video 1080p+720p+480p variants as separate quality items? No — one MediaItem with `quality:"best"` + thumbnail; keep honest). `external.ts` fetches `env.MEDIA_RESOLVER_API_URL` with Bearer key, 8s AbortController timeout, normalizes to ResolvedPost, maps failures to codes. `index.ts` switches on `env.MEDIA_RESOLVER_PROVIDER`.
- [ ] **Step 4: Implement `worker.ts`**: handle CORS same-origin, `POST /api/resolve` (JSON parse, validate, rate-limit Map 20/min/IP, cache Map TTL 300s by sha256 of normalized URL via `crypto.subtle`, resolve, sanitize output), `GET /api/health`, `GET /sitemap.xml`, `GET /robots.txt`, security headers, SPA fallback via `env.ASSETS.fetch`.
- [ ] **Step 5: Run** `npx vitest run tests/validate.test.ts tests/resolver.test.ts` → PASS.

### Task 4: UI matching screenshot

**Files:**
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/components/*.tsx` (Header, Hero, DownloadForm, MediaResult, TrustRow, HowTo, Formats, WhyUs, Faq, CtaBanner, Footer, ThemeToggle, LanguageSwitcher, Toast, AdSlot), `src/pages/*.tsx`
- Test: manual + `tests/i18n.test.ts` (all keys present in fr/ar)

**Interfaces:**
- Consumes: `POST /api/resolve` via `src/lib/api.ts`, i18n dicts
- Produces: routes rendering per SEO registry

- [ ] **Step 1: Build styles + shell** (white bg, black buttons, cards, responsive, focus-visible, reduced-motion).
- [ ] **Step 2: Build DownloadForm** (extract URL client-side, friendly errors, loading/resolved/error states, `aria-live`).
- [ ] **Step 3: Build MediaResult** (video `<video controls preload=none>`, image grid, carousel grid, quality pills, `download` attr, Download All sequential, New Download reset).
- [ ] **Step 4: Build sections + pages** (Home full screenshot; ToolPage reuses Hero+Result with unique copy; Faq/Privacy/Terms/Contact/Blog stubs; 404).
- [ ] **Step 5: Verify** `npx tsc --noEmit` PASS.

### Task 5: Prerender + release verify

**Files:**
- Create: `scripts/prerender.mjs`, `public/favicon.svg`, `public/og-image.svg`
- Test: `tests/prerender.test.ts` (sitemap only canonical, robots disallows /api/)

- [ ] **Step 1: Implement prerender** (import SEO_ROUTES, for each path write `dist/client/<path>/index.html` — or `dist/client/sitemap.xml` copy — with title/meta/canonical/OG/JSON-LD + `<div id=root>` + internal links).
- [ ] **Step 2: Run** `npm run build`, verify `dist/client/sitemap.xml` + per-route HTML contains H1 + canonical.
- [ ] **Step 3: Run full** `npx tsc --noEmit && npx vitest run` → PASS. Update README (overview, env vars, mock/external, deploy, limitations).
