import type { ApiErrorCode, MediaItem, ResolvedPost } from "../types";
import { validateThreadsUrl } from "./validate";
import { getResolver } from "./resolvers";
import { ResolverError } from "./resolvers/types";
import { MemoryCache, cacheKey } from "./services/cache";
import { RateLimiter } from "./services/rate-limit";
import { getDb, isDbConfigured, type DbEnv } from "./db/index";
import type { D1Binding } from "./db/d1";
import { validateSetting } from "./db/types";
import { verifyAdmin, adminCookieHeader, clearAdminCookie, issueDevSession } from "./db/auth";
import { hashPassword, verifyPassword, validateNewPassword } from "./db/password";
import { issueDownloadToken, lookupDownloadToken } from "./services/dl-tokens";
import { mediaFilename, extensionFromMime } from "../lib/filenames";
import {
  validateToolPage,
  validateGuide,
  sanitizeGuideHtml,
  buildRelated,
  parseFaqs,
  parseSlugList,
  type LinkNode,
} from "./content/types";
import { renderToolPage, renderGuide, renderStaticRoute } from "./content/render";
import { trackingFromSettings, type TrackingConfig } from "./content/tracking";
import { adsFromSettings, adsenseHeadHtml } from "./content/ads";
import { SEO_ROUTES } from "../lib/seo-routes";
import { cspHeaderValue } from "../lib/csp";
import { sanitizeApiKey } from "../lib/keys";
import { sha256Hex, hashIp } from "./db/hash";
import { aiConfig, getAiProvider, AiError, maskApiKey, DEFAULT_AI_MODEL, type AiDraft, type AiFaq } from "./ai";

interface Env extends DbEnv {
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  MEDIA_RESOLVER_PROVIDER?: string;
  MEDIA_RESOLVER_API_URL?: string;
  MEDIA_RESOLVER_API_KEY?: string;
  RESOLVE_CACHE_TTL?: string;
  SITE_URL?: string;
  ADMIN_DB?: D1Binding;
  DB_PROVIDER?: string;
  ENVIRONMENT?: string;
  ADMIN_DEV_TOKEN?: string;
  IP_HASH_SALT?: string;
  // AI content generation (server-only; never exposed to the client)
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_PROVIDER?: string;
}

const resolveCache = new MemoryCache<ResolvedPost>(300_000);
const resolveLimiter = new RateLimiter(20, 60_000);
const downloadLimiter = new RateLimiter(30, 60_000);
const adminLoginLimiter = new RateLimiter(5, 60_000);
// AI drafts cost free-tier quota (≈1,500/day): keep admin generation conservative.
const aiLimiter = new RateLimiter(8, 60_000);

function siteUrl(env: Env, req: Request): string {
  const fromEnv = (env.SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

/**
 * `script-src 'self'` blocks inline scripts, which silently killed the theme
 * bootstrap in index.html (wrong-theme flash, stored dark preference ignored).
 * A hash keeps responses cacheable (a per-request nonce would not).
 *
 * Dev exception: Vite injects its own inline scripts (React Refresh preamble,
 * HMR client) whose hash is not in this policy, and the dev runtime needs
 * `eval` for source maps. Sending the production CSP on `npm run dev` crashed
 * hydration ("@vitejs/plugin-react can't detect preamble") and left the page
 * as unstyled SSR text. The policy is therefore production-only; `wrangler dev`
 * runs the production build, so it still exercises the real headers.
 */
const IS_DEV = import.meta.env.DEV;

function securityHeaders(): Headers {
  const h = new Headers();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  h.set("Strict-Transport-Security", "max-age=31536000");
  const csp = cspHeaderValue({ isDev: IS_DEV });
  if (csp) h.set("Content-Security-Policy", csp);
  return h;
}

/**
 * CSRF defense in depth for state-changing admin APIs (all same-origin by
 * design). Rejects requests that explicitly declare a cross-site origin;
 * requests without fetch metadata (curl, tests) are still allowed.
 */
function isCrossSiteRequest(req: Request): boolean {
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs && sfs !== "same-origin" && sfs !== "none") return true;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(req.url).origin) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function json(data: unknown, status: number, extra?: Headers): Response {
  const h = securityHeaders();
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  h.set("X-Robots-Tag", "noindex, nofollow");
  extra?.forEach((v, k) => h.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

/** Branded 404 with real 404 status (no soft-404 SPA shell). */
function notFoundPage(origin: string): Response {
  const h = securityHeaders();
  h.set("content-type", "text/html; charset=utf-8");
  h.set("cache-control", "no-store");
  const body = `<!doctype html><html lang="en"><head><meta charset="UTF-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` +
    `<title>Page not found - Threads Video Downloader</title>` +
    `<meta name="robots" content="noindex, nofollow" />` +
    `<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:64px 24px;text-align:center}</style>` +
    `</head><body><h1>Page not found</h1><p>This link does not exist.</p>` +
    `<p><a href="${origin.replace(/\/$/, "")}/">Back to home</a></p></body></html>`;
  return new Response(body, { status: 404, headers: h });
}

function err(code: ApiErrorCode, message: string, status: number): Response {
  return json({ success: false, error: { code, message } }, status);
}

function rateLimited(): Response {
  const h = new Headers();
  h.set("Retry-After", "60");
  return json({ success: false, error: { code: "RATE_LIMITED", message: MESSAGES.RATE_LIMITED } }, 429, h);
}

const MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_URL: "Please enter a valid public Threads URL.",
  UNSUPPORTED_URL: "This link is not a supported public Threads post URL.",
  NOT_FOUND: "We could not find this post. It may have been deleted.",
  PRIVATE_CONTENT: "This post appears to be private. Only public posts are supported.",
  MEDIA_NOT_FOUND: "No downloadable media was found in this post.",
  RESOLVER_UNAVAILABLE: "Something went wrong while retrieving this media. Please try again.",
  RATE_LIMITED: "Too many requests. Please wait a minute and try again.",
  TEMPORARY_ERROR: "Something went wrong while retrieving this media. Please try again.",
  DOWNLOAD_FAILED: "The download failed. Please try again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
};

/** Media hosts we are willing to stream from. Resolved by our own parsers only. */
function isAllowedMediaHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".fbcdn.net") || h.endsWith(".cdninstagram.com") || h === "fbcdn.net" || h === "cdninstagram.com";
}

function safeDisposition(filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9-_.]/g, "_").slice(0, 128) || "download";
  return `attachment; filename="${clean}"`;
}

/**
 * GET /api/dl/:token — streams server-resolved media with the request
 * context CDNs require (Referer). Streams the body through: never buffers.
 * Tokens are opaque, short-lived, and only ever reference URLs our own
 * resolver produced — this is NOT an open proxy. If the signed CDN URL has
 * expired, the post is re-resolved fresh once (self-healing) instead of
 * serving an error payload as a corrupt file.
 */
async function streamUpstream(target: URL, filename: string, req: Request): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const headers: Record<string, string> = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      referer: "https://www.threads.com/",
      accept: "*/*",
    };
    const range = req.headers.get("range");
    if (range && /^bytes=\d*-\d*$/.test(range)) headers["range"] = range;
    const upstream = await fetch(target.toString(), {
      headers,
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) return null;
    const ct = upstream.headers.get("content-type") || "";
    // Never stream an error page as media: wrong content-type means failure.
    if (!/^(video\/|image\/|audio\/|application\/octet-stream)/.test(ct)) return null;
    const h = securityHeaders();
    h.set("content-type", ct);
    const len = upstream.headers.get("content-length");
    if (len) h.set("content-length", len);
    const cr = upstream.headers.get("content-range");
    if (cr) h.set("content-range", cr);
    h.set("content-disposition", safeDisposition(filename));
    h.set("cache-control", "no-store");
    h.set("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers: h });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fresh re-resolve bypassing the metadata cache (signatures may have rotated). */
async function resolveFreshMedia(postUrl: string, itemId: string, env: Env): Promise<string | null> {
  const v = validateThreadsUrl(postUrl);
  if (!v.ok) return null;
  try {
    const post = await getResolver(env).resolve(v.url, v.normalized);
    const item = (post.mediaItems || []).find((m) => m.id === itemId);
    const url = item && item.url.startsWith("https://") ? item.url : null;
    if (!url) return null;
    const target = new URL(url);
    if (!isAllowedMediaHost(target.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function handleDownload(req: Request, env: Env, token: string): Promise<Response> {
  if (!downloadLimiter.allow(clientIp(req))) return rateLimited();
  const entry = lookupDownloadToken(token);
  if (!entry) return err("NOT_FOUND", "This download link has expired. Please resolve the post again.", 404);
  let target: URL;
  try {
    target = new URL(entry.url);
  } catch {
    return err("DOWNLOAD_FAILED", MESSAGES.DOWNLOAD_FAILED, 502);
  }
  if (target.protocol !== "https:" || !isAllowedMediaHost(target.hostname)) {
    return err("DOWNLOAD_FAILED", MESSAGES.DOWNLOAD_FAILED, 502);
  }
  const direct = await streamUpstream(target, entry.filename, req);
  if (direct) return direct;
  // Signed URL likely expired: re-resolve the same item fresh, once.
  if (entry.postUrl && entry.itemId) {
    const fresh = await resolveFreshMedia(entry.postUrl, entry.itemId, env);
    if (fresh && fresh !== entry.url) {
      try {
        const freshTarget = new URL(fresh);
        if (freshTarget.protocol === "https:" && isAllowedMediaHost(freshTarget.hostname)) {
          const retry = await streamUpstream(freshTarget, entry.filename, req);
          if (retry) return retry;
        }
      } catch {
        /* fall through */
      }
    }
  }
  return err("DOWNLOAD_FAILED", "The download link expired and refresh failed. Please resolve the post again.", 502);
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

export function sanitizePost(post: ResolvedPost): ResolvedPost {
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === "string" ? v.slice(0, max) : undefined;
  return {
    postUrl: str(post.postUrl, 512) ?? "",
    postId: str(post.postId, 64),
    username: str(post.username, 64),
    profileUrl: str(post.profileUrl, 256),
    caption: str(post.caption, 500),
    thumbnail: str(post.thumbnail, 1024),
    mediaItems: Array.isArray(post.mediaItems)
      ? post.mediaItems.slice(0, 20).map((m: MediaItem, i: number) => ({
          id: str(m.id, 64) ?? `item-${i}`,
          type: (["video", "image", "gif", "audio"] as const).includes(m.type) ? m.type : "image",
          // Real CDN URLs run ~1100+ chars; truncating breaks their signatures.
          url: str(m.url, 2048) ?? "",
          dl: str(m.dl, 128),
          thumbnail: str(m.thumbnail, 512),
          width: typeof m.width === "number" ? m.width : undefined,
          height: typeof m.height === "number" ? m.height : undefined,
          duration: typeof m.duration === "number" ? m.duration : undefined,
          mimeType: str(m.mimeType, 64),
          fileSize: typeof m.fileSize === "number" ? m.fileSize : undefined,
          quality: str(m.quality, 16),
          extension: str(m.extension, 8),
        }))
      : [],
  };
}

// Sitemap/robots built lazily to avoid importing client-only modules.
// Single source of truth: derive from the SEO_ROUTES registry so the sitemap
// can never drift from the canonical route list (see scripts/gen-static-seo.mjs).
function seoRoutes(): { path: string }[] {
  return SEO_ROUTES.map((r) => ({ path: r.path }));
}

/**
 * Admin is a client-side app (login + dashboards) and must never be indexed.
 * Asset routing no longer has an SPA fallback, so the Worker serves the shell
 * explicitly and marks the response noindex at the HTTP level.
 */
async function adminShell(req: Request, env: Env): Promise<Response> {
  const template = await appTemplate(req, env);
  if (!template) return notFoundPage(siteUrl(env, req));
  const h = securityHeaders();
  h.set("content-type", "text/html; charset=utf-8");
  h.set("cache-control", "no-store");
  h.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(req.method === "HEAD" ? null : template, { status: 200, headers: h });
}

/** Percent-encode path segments for <loc> (sitemap spec; Arabic slugs). */
export function encodePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Canonical path: strip trailing slashes (except root). Pure, unit-tested. */
export function canonicalPath(pathname: string): string {
  if (pathname.length > 1) return pathname.replace(/\/+$/, "") || "/";
  return pathname;
}

export function sitemapXml(origin: string, extra: { kind: string; slug: string; updated_at: string }[] = []): string {
  const root = origin.replace(/\/$/, "");
  const seen = new Set<string>();
  const base: string[] = [];
  const add = (loc: string, lastmod = ""): void => {
    if (seen.has(loc)) return;
    seen.add(loc);
    base.push(`  <url><loc>${loc}</loc>${lastmod}</url>`);
  };
  // Live DB entries first so their real <lastmod> wins on collisions.
  for (const e of extra) {
    const loc = e.kind === "guide" ? `/blog/${e.slug}` : `/${e.slug}`;
    const lastmod = e.updated_at ? `<lastmod>${e.updated_at.slice(0, 10)}</lastmod>` : "";
    add(`${root}${encodePath(loc)}`, lastmod);
  }
  for (const r of seoRoutes()) add(`${root}${encodePath(r.path)}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${base.join("\n")}\n</urlset>`;
}

// Static public paths that tool slugs must never shadow.
const RESERVED_SLUGS = new Set([
  "admin", "api", "blog", "faq", "privacy", "terms", "contact",
  "threads-video-downloader", "threads-photo-downloader", "threads-carousel-downloader",
  "how-to-download-threads-videos", "sitemap.xml", "robots.txt", "favicon.svg", "og-image.svg",
]);

/** Short-lived in-memory cache for the live-slug set (sitemap + routing). */
const slugCache = new MemoryCache<{ kind: "tool" | "guide"; slug: string; updated_at: string }[]>(60_000);

async function liveSlugs(env: Env): Promise<{ kind: "tool" | "guide"; slug: string; updated_at: string }[]> {
  const cached = slugCache.get("live");
  if (cached) return cached;
  const db = getDb(env);
  if (!db) return [];
  try {
    const slugs = await db.listLiveSlugs();
    slugCache.set("live", slugs);
    return slugs;
  } catch {
    return [];
  }
}

// Template (SPA shell) cache for server-rendered SEO pages. Short TTL so a
// deploy (new hashed asset filenames) is picked up quickly by every isolate.
const templateCache = new MemoryCache<string>(60_000);

async function appTemplate(req: Request, env: Env): Promise<string | null> {
  const cached = templateCache.get("index");
  if (cached) return cached;
  if (!env.ASSETS) return null; // e.g. plain wrangler dev without assets binding
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/index.html", req.url).toString()));
    if (!res.ok) return null;
    const html = await res.text();
    templateCache.set("index", html);
    return html;
  } catch {
    return null;
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  return (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
}

function normalizeContentInput(body: Record<string, unknown>, isGuide: boolean): Record<string, unknown> {
  const faqs = parseFaqs(body["faqs"]);
  const related = parseSlugList(body["related_slugs"]);
  const base: Record<string, unknown> = {
    slug: typeof body["slug"] === "string" ? body["slug"].trim() : "",
    lang: body["lang"] ?? "en",
    target_keyword: typeof body["target_keyword"] === "string" ? body["target_keyword"].trim() : "",
    title: typeof body["title"] === "string" ? body["title"].trim() : "",
    description: typeof body["description"] === "string" ? body["description"].trim() : "",
    h1: typeof body["h1"] === "string" ? body["h1"].trim() : "",
    faqs,
    related_slugs: related,
    status: body["status"] ?? "draft",
  };
  if (isGuide) {
    base["body"] = sanitizeGuideHtml(typeof body["body"] === "string" ? body["body"] : "");
  } else {
    base["badge"] = typeof body["badge"] === "string" ? body["badge"].trim().slice(0, 40) : "";
    base["intro"] = typeof body["intro"] === "string" ? body["intro"].trim() : "";
  }
  return base;
}

async function uniquenessError(
  db: NonNullable<ReturnType<typeof getDb>>,
  kind: "tool" | "guide",
  input: Record<string, unknown>,
  ignoreId?: number,
): Promise<string | null> {
  const list = kind === "tool" ? await db.listToolPages() : await db.listGuides();
  const others = list.filter((r) => r.id !== ignoreId);
  if (others.some((r) => r.slug === input["slug"])) return `Slug "${input["slug"]}" is already used.`;
  if (others.some((r) => r.title === input["title"])) return "Another page already uses this exact title (no duplicate content).";
  if (others.some((r) => r.description === input["description"])) return "Another page already uses this exact meta description.";
  return null;
}

function robotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ${origin.replace(/\/$/, "")}/sitemap.xml\n`;
}

function dbUnavailable(): Response {
  return err("RESOLVER_UNAVAILABLE", "Admin database is not configured.", 503);
}

/** Fire-and-forget analytics: never slows the response, never throws. */
function logResolveEvent(req: Request, env: Env, normalized: string, status: string, mediaCount: number): void {
  try {
    if (!isDbConfigured(env)) return;
    const url = new URL(req.url);
    const work = (async () => {
      const db = getDb(env);
      if (!db) return;
      const [urlHash, ipHash] = await Promise.all([
        sha256Hex(`url:${normalized}`),
        hashIp(clientIp(req), env.IP_HASH_SALT || "local-dev-salt"),
      ]);
      await db.logEvent({
        urlHash,
        status,
        mediaCount,
        ipHash,
        userAgent: req.headers.get("user-agent") || undefined,
      });
    })();
    // Workers runtime: extend lifetime without blocking the response.
    const ctx = (globalThis as unknown as { __ctx?: { waitUntil(p: Promise<unknown>): void } }).__ctx;
    if (ctx) ctx.waitUntil(work);
    else void work.catch(() => {});
    void url;
  } catch {
    /* analytics must never break downloads */
  }
}

async function requireAdmin(req: Request, env: Env): Promise<Response | null> {
  if (!isDbConfigured(env)) return dbUnavailable();
  const email = await verifyAdmin(req, env);
  if (!email) return err("UNKNOWN_ERROR", "Not authorized.", 401);
  return null;
}

async function handleAdminLogin(req: Request, env: Env): Promise<Response> {
  if (!adminLoginLimiter.allow(clientIp(req))) return rateLimited();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("INVALID_URL", "Invalid login request.", 400);
  }
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return err("INVALID_URL", "Email and password are required.", 400);
  }
  // TEMPORARY dev-only login (no Supabase Auth locally). Strictly gated: ENVIRONMENT must be "dev".
  // Accepts the bootstrap env token OR the dashboard-set DB password.
  if (env.ENVIRONMENT === "dev" && email === "admin") {
    const secure = new URL(req.url).protocol === "https:";
    if (env.ADMIN_DEV_TOKEN && password === env.ADMIN_DEV_TOKEN) {
      const h = new Headers();
      h.append("Set-Cookie", adminCookieHeader(env.ADMIN_DEV_TOKEN, secure));
      return json({ success: true }, 200, h);
    }
    const db = getDb(env);
    if (db) {
      try {
        const settings = await db.getSettings();
        const stored = settings["admin_password_hash"];
        if (stored && (await verifyPassword(password, stored))) {
          const h = new Headers();
          h.append("Set-Cookie", adminCookieHeader(await issueDevSession(env), secure));
          return json({ success: true }, 200, h);
        }
      } catch {
        /* fall through to invalid credentials */
      }
    }
    return err("UNKNOWN_ERROR", "Invalid credentials.", 401);
  }
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_ANON_KEY?.trim()) return dbUnavailable();
  try {
    const res = await fetch(`${env.SUPABASE_URL.trim().replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_ANON_KEY.trim(), "content-type": "application/json" },
      body: JSON.stringify({ email: email.slice(0, 256), password: password.slice(0, 256) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return err("UNKNOWN_ERROR", "Invalid credentials.", 401);
    const data = (await res.json()) as { access_token?: string; user?: { app_metadata?: { role?: string } } };
    if (!data.access_token || data.user?.app_metadata?.role !== "admin") {
      return err("UNKNOWN_ERROR", "Not authorized.", 403);
    }
    const h = new Headers();
    const secure = new URL(req.url).protocol === "https:";
    h.append("Set-Cookie", adminCookieHeader(data.access_token, secure));
    return json({ success: true }, 200, h);
  } catch {
    return err("TEMPORARY_ERROR", MESSAGES.TEMPORARY_ERROR, 503);
  }
}

async function handleAdmin(req: Request, env: Env, pathname: string): Promise<Response> {
  // All admin APIs are same-origin by design: reject explicit cross-site callers.
  if (req.method !== "GET" && isCrossSiteRequest(req)) {
    return err("UNKNOWN_ERROR", "Forbidden.", 403);
  }
  if (req.method === "POST" && pathname === "/api/admin/login") return handleAdminLogin(req, env);
  if (req.method === "POST" && pathname === "/api/admin/logout") {
    const h = new Headers();
    h.append("Set-Cookie", clearAdminCookie());
    return json({ success: true }, 200, h);
  }
  const gate = await requireAdmin(req, env);
  if (gate) return gate;
  const db = getDb(env);
  if (!db) return dbUnavailable();
  try {
    if (req.method === "GET" && pathname === "/api/admin/stats") {
      return json({ success: true, data: await db.getStats() }, 200);
    }
    if (req.method === "GET" && pathname === "/api/admin/requests") {
      const u = new URL(req.url);
      const limit = Number(u.searchParams.get("limit") || "20");
      const offset = Number(u.searchParams.get("offset") || "0");
      return json({ success: true, data: await db.listEvents(limit, offset) }, 200);
    }
    if (req.method === "GET" && pathname === "/api/admin/settings") {
      const all = await db.getSettings();
      // Never expose the password hash or the AI API key through the API.
      const { admin_password_hash: _hidden, gemini_api_key: _aiKey, ...safe } = all;
      void _hidden;
      void _aiKey;
      // The UI only needs to know a key exists — show a masked hint.
      safe["gemini_key_hint"] = maskApiKey(String(all["gemini_api_key"] || ""));
      return json({ success: true, data: safe }, 200);
    }
    if (req.method === "PUT" && pathname === "/api/admin/settings") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return err("INVALID_URL", "Invalid settings payload.", 400);
      }
      let { key, value } = body as { key?: unknown; value?: unknown };
      // Pasted keys often carry invisible characters (spaces, newlines,
      // zero-width/bidi marks from RTL UIs) — strip before validating/storing.
      if (key === "gemini_api_key" && typeof value === "string") value = sanitizeApiKey(value);
      if (typeof key !== "string" || typeof value !== "string" || !validateSetting(key, value)) {
        return err("INVALID_URL", "Invalid setting key or value.", 400);
      }
      await db.updateSetting(key, value);
      // Settings drive live behavior: bust DB-backed caches so saves apply now.
      trackingCache.clear();
      adsCache.clear();
      aiConfigCache.clear();
      return json({ success: true }, 200);
    }
    if (req.method === "PUT" && pathname === "/api/admin/password") {
      // TEMPORARY dev-only password management (Supabase Auth handles this in production).
      if (env.ENVIRONMENT !== "dev") return err("UNKNOWN_ERROR", "Not available.", 404);
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return err("INVALID_URL", "Invalid password payload.", 400);
      }
      const { current, next } = body as { current?: unknown; next?: unknown };
      if (typeof current !== "string" || !validateNewPassword(next)) {
        return err("INVALID_URL", "Current password is required and the new password must be 8-128 characters.", 400);
      }
      // Verify current: bootstrap env token OR existing DB password (or none set yet + env token).
      let currentOk = Boolean(env.ADMIN_DEV_TOKEN && current === env.ADMIN_DEV_TOKEN);
      if (!currentOk) {
        try {
          const settings = await db.getSettings();
          const stored = settings["admin_password_hash"];
          currentOk = Boolean(stored && (await verifyPassword(current, stored)));
        } catch {
          currentOk = false;
        }
      }
      if (!currentOk) return err("UNKNOWN_ERROR", "Current password is incorrect.", 401);
      await db.updateSetting("admin_password_hash", await hashPassword(next as string));
      return json({ success: true }, 200);
    }
    // ---- AI draft generation (Gemini free tier) ----
    if (req.method === "POST" && pathname === "/api/admin/ai/draft") {
      if (!aiLimiter.allow(clientIp(req))) return rateLimited();
      const body = asRecord(await req.json().catch(() => null));
      const kind = body["kind"] === "tool" || body["kind"] === "guide" ? body["kind"] : null;
      const targetKeyword = typeof body["target_keyword"] === "string" ? body["target_keyword"].trim().slice(0, 120) : "";
      const lang = body["lang"] === "en" || body["lang"] === "fr" || body["lang"] === "ar" ? body["lang"] : "en";
      if (!kind || targetKeyword.length < 3) {
        return err("INVALID_URL", "Target keyword (3+ chars) and kind are required.", 400);
      }
      const cfg = await getAiConfig(env);
      if (!cfg.apiKey) {
        return err("RESOLVER_UNAVAILABLE", "AI generator is not configured. Add a Gemini API key in the engine settings.", 503);
      }
      // Uniqueness + internal-link context from live DB content.
      const [tools, guides] = await Promise.all([db.listToolPages(), db.listGuides()]);
      const all = [...tools, ...guides];
      const existingTitles = all.map((r) => r.title).slice(0, 40);
      const existingFaqQuestions = all.flatMap((r) => r.faqs.map((f) => f.q)).slice(0, 40);
      const liveSlugs = [
        ...tools.filter((t) => t.status === "live"),
        ...guides.filter((g) => g.status === "live"),
      ];
      const allowedSlugs = liveSlugs.map((r) => r.slug).slice(0, 40);
      const linkPaths = [
        ...tools.filter((t) => t.status === "live").slice(0, 20).map((t) => `/${t.slug}`),
        ...guides.filter((g) => g.status === "live").slice(0, 20).map((g) => `/blog/${g.slug}`),
      ];
      let draft: AiDraft;
      try {
        draft = await getAiProvider(cfg).generate({ kind, targetKeyword, lang, context: { existingTitles, existingFaqQuestions, allowedSlugs, linkPaths } });
      } catch (e) {
        if (e instanceof AiError) {
          const status = e.code === "AI_NOT_CONFIGURED" ? 503 : e.code === "AI_QUOTA" ? 429 : 502;
          // Admin-only endpoint: include Google's sanitized message so the
          // admin can tell a bad key apart from a model/quota problem.
          const message = e.detail ? `${e.message} [Provider: ${e.detail}]` : e.message;
          return err("RESOLVER_UNAVAILABLE", message, status);
        }
        return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 500);
      }
      // Slug hygiene: reserved names always get a suffix, collisions get -2, -3…
      const taken = new Set([...all.map((r) => r.slug), ...RESERVED_SLUGS]);
      let slug = draft.slug;
      if (taken.has(slug)) {
        let n = 2;
        while (taken.has(`${slug}-${n}`)) n += 1;
        slug = `${slug}-${n}`;
      }
      draft = { ...draft, slug } as AiDraft;
      // Soft quality report (hard validation still runs on save).
      const warnings: string[] = [
        "AI draft inserted. Review every field before saving — publish manually only when you are happy with the quality.",
      ];
      const input: Record<string, unknown> = {
        slug,
        lang,
        target_keyword: targetKeyword,
        title: draft.title,
        description: draft.description,
        h1: draft.h1,
        faqs: draft.faqs as AiFaq[],
        related_slugs: draft.related_slugs,
        status: "draft",
      };
      if (draft.kind === "tool") {
        input["badge"] = draft.badge;
        input["intro"] = draft.intro;
      } else {
        input["body"] = draft.body;
      }
      const validation = draft.kind === "tool" ? validateToolPage(input) : validateGuide(input);
      if (validation) warnings.push(`Validation warning: ${validation}`);
      if (draft.related_slugs.length === 0) warnings.push("No related pages available yet — cross-links are auto-suggested at render time.");
      return json({ success: true, data: { draft, warnings } }, 200);
    }
    // ---- SEO content engines (tool pages + guides) ----
    if (pathname === "/api/admin/tool-pages" && req.method === "GET") {
      return json({ success: true, data: await db.listToolPages() }, 200);
    }
    if (pathname === "/api/admin/tool-pages" && req.method === "POST") {
      const input = normalizeContentInput(asRecord(await req.json().catch(() => null)), false);
      const validation = validateToolPage(input);
      if (validation) return err("INVALID_URL", validation, 400);
      if (RESERVED_SLUGS.has(String(input["slug"]))) return err("INVALID_URL", "Slug is reserved.", 400);
      const dup = await uniquenessError(db, "tool", input);
      if (dup) return err("INVALID_URL", dup, 409);
      return json({ success: true, data: await db.createToolPage(input as never) }, 201);
    }
    {
      const m = pathname.match(/^\/api\/admin\/tool-pages\/(\d+)$/);
      if (m) {
        const id = Number(m[1]);
        if (req.method === "GET") {
          const page = await db.getToolPage(id);
          return page ? json({ success: true, data: page }, 200) : err("NOT_FOUND", "Not found.", 404);
        }
        if (req.method === "PUT") {
          const input = normalizeContentInput(asRecord(await req.json().catch(() => null)), false);
          const validation = validateToolPage(input);
          if (validation) return err("INVALID_URL", validation, 400);
          if (RESERVED_SLUGS.has(String(input["slug"]))) return err("INVALID_URL", "Slug is reserved.", 400);
          const dup = await uniquenessError(db, "tool", input, id);
          if (dup) return err("INVALID_URL", dup, 409);
          const page = await db.updateToolPage(id, input as never);
          return page ? json({ success: true, data: page }, 200) : err("NOT_FOUND", "Not found.", 404);
        }
        if (req.method === "DELETE") {
          return json({ success: await db.deleteToolPage(id) }, 200);
        }
      }
    }
    if (pathname === "/api/admin/guides" && req.method === "GET") {
      return json({ success: true, data: await db.listGuides() }, 200);
    }
    if (pathname === "/api/admin/guides" && req.method === "POST") {
      const input = normalizeContentInput(asRecord(await req.json().catch(() => null)), true);
      const validation = validateGuide(input);
      if (validation) return err("INVALID_URL", validation, 400);
      const dup = await uniquenessError(db, "guide", input);
      if (dup) return err("INVALID_URL", dup, 409);
      return json({ success: true, data: await db.createGuide(input as never) }, 201);
    }
    {
      const m = pathname.match(/^\/api\/admin\/guides\/(\d+)$/);
      if (m) {
        const id = Number(m[1]);
        if (req.method === "GET") {
          const guide = await db.getGuide(id);
          return guide ? json({ success: true, data: guide }, 200) : err("NOT_FOUND", "Not found.", 404);
        }
        if (req.method === "PUT") {
          const input = normalizeContentInput(asRecord(await req.json().catch(() => null)), true);
          const validation = validateGuide(input);
          if (validation) return err("INVALID_URL", validation, 400);
          const dup = await uniquenessError(db, "guide", input, id);
          if (dup) return err("INVALID_URL", dup, 409);
          const guide = await db.updateGuide(id, input as never);
          return guide ? json({ success: true, data: guide }, 200) : err("NOT_FOUND", "Not found.", 404);
        }
        if (req.method === "DELETE") {
          return json({ success: await db.deleteGuide(id) }, 200);
        }
      }
    }
    return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 404);
  } catch {
    return err("TEMPORARY_ERROR", MESSAGES.TEMPORARY_ERROR, 503);
  }
}

/** Attach fresh same-origin download tokens (per response, never cached). */
function withDownloadTokens(post: ResolvedPost): ResolvedPost {
  const postId = post.postId || "post";
  return {
    ...post,
    mediaItems: post.mediaItems.map((m, i) => {
      const ext = m.extension || extensionFromMime(m.mimeType, m.type === "video" ? "mp4" : "jpg");
      const kind = m.type === "video" ? "video" : m.type === "image" ? "image" : "media";
      const filename = mediaFilename(kind, postId, i, ext);
      const token = issueDownloadToken(m.url, filename, post.postUrl, m.id);
      return { ...m, dl: `/api/dl/${token}` };
    }),
  };
}

/** Cross-link pool: all live tools + guides as link nodes (cached with slugs). */
const poolCache = new MemoryCache<LinkNode[]>(60_000);

async function linkPool(env: Env): Promise<LinkNode[]> {
  const cached = poolCache.get("pool");
  if (cached) return cached;
  const db = getDb(env);
  if (!db) return [];
  try {
    // Sequential DB calls: safest across SQLite and Postgres providers.
    const tools = await db.listToolPages();
    const guides = await db.listGuides();
    const pool: LinkNode[] = [
      ...tools.filter((t) => t.status === "live").map((t) => ({ kind: "tool" as const, slug: t.slug, title: t.title, lang: t.lang, target_keyword: t.target_keyword })),
      ...guides.filter((g) => g.status === "live").map((g) => ({ kind: "guide" as const, slug: g.slug, title: g.title, lang: g.lang, target_keyword: g.target_keyword })),
    ];
    poolCache.set("pool", pool);
    return pool;
  } catch {
    return [];
  }
}

// Tracking + ads config cache (DB-backed, no rebuild needed).
const trackingCache = new MemoryCache<TrackingConfig>(60_000);
const adsCache = new MemoryCache<ReturnType<typeof adsFromSettings>>(60_000);
const aiConfigCache = new MemoryCache<ReturnType<typeof aiConfig>>(60_000);

async function getAiConfig(env: Env) {
  const envKey = (env.GEMINI_API_KEY || "").trim();
  const envModel = (env.GEMINI_MODEL || "").trim();
  if (envKey || envModel) {
    return aiConfig({ GEMINI_API_KEY: envKey, GEMINI_MODEL: envModel }, {});
  }
  const cached = aiConfigCache.get("ai");
  if (cached) return cached;
  const db = getDb(env);
  if (!db) return { apiKey: "", model: DEFAULT_AI_MODEL };
  try {
    const cfg = aiConfig({}, await db.getSettings());
    aiConfigCache.set("ai", cfg);
    return cfg;
  } catch {
    return { apiKey: "", model: DEFAULT_AI_MODEL };
  }
}

async function getTracking(env: Env): Promise<TrackingConfig | undefined> {
  const cached = trackingCache.get("tracking");
  if (cached) return cached;
  const db = getDb(env);
  if (!db) return undefined;
  try {
    const t = trackingFromSettings(await db.getSettings());
    trackingCache.set("tracking", t);
    return t;
  } catch {
    return undefined;
  }
}

async function getAds(env: Env) {
  const cached = adsCache.get("ads");
  if (cached) return cached;
  const db = getDb(env);
  if (!db) return undefined;
  try {
    const a = adsFromSettings(await db.getSettings());
    adsCache.set("ads", a);
    return a;
  } catch {
    return undefined;
  }
}

/** Widen CSP only when tracking scripts are actually configured. */
function htmlSecurityHeaders(tracking: TrackingConfig | undefined, adsAuto = false): Headers {
  const h = securityHeaders();
  if (!tracking) return h;
  const vendors: string[] = [];
  if (tracking.ga4_id) vendors.push("https://www.googletagmanager.com", "https://www.google-analytics.com");
  if (tracking.pixel_id) vendors.push("https://connect.facebook.net", "https://www.facebook.com");
  if (adsAuto) vendors.push("https://pagead2.googlesyndication.com", "https://googleads.g.doubleclick.net");
  const hasCustom = tracking.head_custom.length > 0 || tracking.body_custom.length > 0;
  if (vendors.length === 0 && !hasCustom) return h;
  // GA4/Pixel bootstraps and admin custom code are inline, so inline must be
  // allowed whenever any tracking is configured. cspHeaderValue then drops the
  // theme hash (a hash would make browsers ignore 'unsafe-inline').
  const scriptSrc = [...vendors, "'unsafe-inline'"];
  const csp = cspHeaderValue({
    isDev: IS_DEV,
    scriptSrc,
    connectSrc: vendors,
    imgSrc: vendors,
  });
  if (csp) h.set("Content-Security-Policy", csp);
  return h;
}

function publicContentHeaders(tracking?: TrackingConfig, adsAuto = false): Headers {
  const h = htmlSecurityHeaders(tracking, adsAuto);
  h.set("cache-control", "public, max-age=60");
  return h;
}

/** Public, cacheable JSON payloads are never search results. */
function publicJsonHeaders(): Headers {
  const h = publicContentHeaders();
  h.set("content-type", "application/json; charset=utf-8");
  h.set("X-Robots-Tag", "noindex, nofollow");
  return h;
}

/** Auto-ads head script for a request (empty when disabled/unconfigured). */
async function pageAdsHead(env: Env): Promise<{ html: string; auto: boolean }> {
  const ads = await getAds(env);
  if (!ads || !ads.pubId || !ads.autoAds) return { html: "", auto: false };
  return { html: adsenseHeadHtml(ads), auto: true };
}

/** Server rendering for built-in static SEO routes (no DB required). */
export async function handleStaticSeo(req: Request, env: Env, pathname: string): Promise<Response | null> {
  // HEAD must return the same status/headers as GET (crawlers, monitors, proxies).
  const wantsBody = req.method === "GET";
  if (!wantsBody && req.method !== "HEAD") return null;
  const route = SEO_ROUTES.find((r) => r.path === pathname);
  if (!route) return null;
  const origin = siteUrl(env, req).replace(/\/$/, "");
  const template = await appTemplate(req, env);
  const tracking = await getTracking(env);
  const ads = await pageAdsHead(env);
  // The /blog hub lists live guides (best-effort: empty when DB is down).
  let guides: { slug: string; title: string }[] | undefined;
  if (pathname === "/blog") {
    try {
      const db = getDb(env);
      guides = db ? (await db.listGuides()).filter((g) => g.status === "live").map((g) => ({ slug: g.slug, title: g.title })) : [];
    } catch {
      guides = [];
    }
  }
  const h = publicContentHeaders(tracking, ads.auto);
  h.set("content-type", "text/html; charset=utf-8");
  const html = renderStaticRoute(template, origin, "/og-image.png", route, tracking, ads.html, guides);
  return new Response(wantsBody ? html : null, { status: 200, headers: h });
}

export async function handlePublicContent(req: Request, env: Env, pathname: string): Promise<Response | null> {
  const db = getDb(env);
  if (!db) return null;
  // URL.pathname arrives percent-encoded; decode for slug matching (Arabic slugs).
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    /* keep raw */
  }
  // Public guides index for the /blog hub (live only, light public fields).
  if (decoded === "/api/content/guides" && req.method === "GET") {
    try {
      const guides = (await db.listGuides())
        .filter((g) => g.status === "live")
        .slice(0, 100)
        .map((g) => ({ slug: g.slug, title: g.title, description: g.description, lang: g.lang, updated_at: g.updated_at ?? "" }));
      const h = publicJsonHeaders();
      return new Response(JSON.stringify({ success: true, data: guides }), { status: 200, headers: h });
    } catch {
      return null;
    }
  }
  // Public tool-pages index for sitemap enrichment (live only, light fields).
  if (decoded === "/api/content/tools" && req.method === "GET") {
    try {
      const tools = (await db.listToolPages())
        .filter((t) => t.status === "live")
        .slice(0, 100)
        .map((t) => ({ slug: t.slug, title: t.title, description: t.description, lang: t.lang, updated_at: t.updated_at ?? "" }));
      return new Response(JSON.stringify({ success: true, data: tools }), { status: 200, headers: publicJsonHeaders() });
    } catch {
      return null;
    }
  }
  const toolApi = decoded.match(/^\/api\/content\/tool\/([A-Za-z0-9\u0600-\u06FF\-_]+)$/u);
  if (toolApi && req.method === "GET") {
    try {
      const page = await db.getToolPageBySlug(toolApi[1]);
      if (!page || page.status !== "live") return null;
      return new Response(JSON.stringify({ success: true, data: page }), { status: 200, headers: publicJsonHeaders() });
    } catch {
      return null;
    }
  }
  const guideApi = decoded.match(/^\/api\/content\/guide\/([A-Za-z0-9\u0600-\u06FF\-_]+)$/u);
  if (guideApi && req.method === "GET") {
    try {
      const guide = await db.getGuideBySlug(guideApi[1]);
      if (!guide || guide.status !== "live") return null;
      return new Response(JSON.stringify({ success: true, data: guide }), { status: 200, headers: publicJsonHeaders() });
    } catch {
      return null;
    }
  }
  const wantsBody = req.method === "GET";
  if (!wantsBody && req.method !== "HEAD") return null;
  // Server-rendered SEO pages for live DB slugs (crawlable without JS).
  const origin = siteUrl(env, req).replace(/\/$/, "");
  const tracking = await getTracking(env);
  // Only root-level slugs are tool pages; deeper unknown paths fall to SPA.
  const blogMatch = decoded.match(/^\/blog\/([A-Za-z0-9\u0600-\u06FF\-_]+)$/u);
  const isRootSlug = decoded !== "/" && !decoded.slice(1).includes("/");
  if (!blogMatch && !isRootSlug) return null;
  if (!blogMatch && RESERVED_SLUGS.has(decoded.slice(1))) return null;
  const template = await appTemplate(req, env); // null when assets binding unavailable: renderers fall back to a standalone shell
  const pool = await linkPool(env);
  if (blogMatch) {
    try {
      const guide = await db.getGuideBySlug(blogMatch[1]);
      if (!guide || guide.status !== "live") return null;
      const related = buildRelated(guide, pool);
      const ads = await pageAdsHead(env);
      const h = publicContentHeaders(tracking, ads.auto);
      h.set("content-type", "text/html; charset=utf-8");
      const html = renderGuide(template, origin, "/og-image.png", guide, related, tracking, ads.html);
      return new Response(wantsBody ? html : null, { status: 200, headers: h });
    } catch {
      return null;
    }
  }
  try {
    const page = await db.getToolPageBySlug(decoded.slice(1));
    if (!page || page.status !== "live") return null;
    const related = buildRelated(page, pool);
    const ads = await pageAdsHead(env);
    const h = publicContentHeaders(tracking, ads.auto);
    h.set("content-type", "text/html; charset=utf-8");
    const html = renderToolPage(template, origin, "/og-image.png", page, related, tracking, ads.html);
    return new Response(wantsBody ? html : null, { status: 200, headers: h });
  } catch {
    return null;
  }
}

async function handleResolve(req: Request, env: Env): Promise<Response> {
  if (!resolveLimiter.allow(clientIp(req))) {
    logResolveEvent(req, env, "rate-limited", "RATE_LIMITED", 0);
    return rateLimited();
  }
  const len = Number(req.headers.get("content-length") || "0");
  if (len > 4096) return err("INVALID_URL", MESSAGES.INVALID_URL, 400);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("INVALID_URL", MESSAGES.INVALID_URL, 400);
  }
  const input = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  if (!input || input.length > 2048) return err("INVALID_URL", MESSAGES.INVALID_URL, 400);
  const v = validateThreadsUrl(input);
  if (!v.ok) {
    const status = v.code === "UNSUPPORTED_URL" ? 400 : 400;
    return err(v.code, MESSAGES[v.code], status);
  }
  const key = await cacheKey(v.normalized);
  const cached = resolveCache.get(key);
  if (cached) {
    logResolveEvent(req, env, v.normalized, "SUCCESS", cached.mediaItems.length);
    return json({ success: true, data: withDownloadTokens(cached) }, 200);
  }
  try {
    const resolver = getResolver(env);
    const post = await resolver.resolve(v.url, v.normalized);
    if (!post.mediaItems || post.mediaItems.length === 0) {
      logResolveEvent(req, env, v.normalized, "MEDIA_NOT_FOUND", 0);
      return err("MEDIA_NOT_FOUND", MESSAGES.MEDIA_NOT_FOUND, 404);
    }
    const safe = sanitizePost(post);
    resolveCache.set(key, safe);
    logResolveEvent(req, env, v.normalized, "SUCCESS", safe.mediaItems.length);
    return json({ success: true, data: withDownloadTokens(safe) }, 200);
  } catch (e) {
    if (e instanceof ResolverError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "PRIVATE_CONTENT" ? 403 : e.code === "MEDIA_NOT_FOUND" ? 404 : 503;
      const code = e.code as ApiErrorCode;
      logResolveEvent(req, env, v.normalized, code, 0);
      return err(code, MESSAGES[code], status);
    }
    logResolveEvent(req, env, v.normalized, "UNKNOWN_ERROR", 0);
    return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 500);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, resolver: getResolver(env).name }, 200);
    }
    if (req.method === "POST" && url.pathname === "/api/resolve") {
      return handleResolve(req, env);
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/dl/")) {
      return handleDownload(req, env, url.pathname.slice("/api/dl/".length));
    }
    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(req, env, url.pathname);
    }
    // GET and HEAD (crawlers/proxies preflight with HEAD) both serve the XML.
    // Short 300s edge TTL: sitemap reflects live slugs, and a short TTL bounds
    // the lifetime of any stale copy held by third-party proxies.
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/sitemap.xml") {
      const h = securityHeaders();
      h.set("content-type", "application/xml; charset=utf-8");
      h.set("cache-control", "public, max-age=300");
      const body = sitemapXml(siteUrl(env, req), await liveSlugs(env));
      return new Response(req.method === "HEAD" ? null : body, { status: 200, headers: h });
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/robots.txt") {
      const h = securityHeaders();
      h.set("content-type", "text/plain; charset=utf-8");
      h.set("cache-control", "public, max-age=300");
      const body = robotsTxt(siteUrl(env, req));
      return new Response(req.method === "HEAD" ? null : body, { status: 200, headers: h });
    }
    if (url.pathname.startsWith("/api/")) {
      // Public content JSON APIs (live slugs) before the generic API 404.
      const content = await handlePublicContent(req, env, url.pathname);
      if (content) return content;
      // Public tracking bootstrap for the SPA shell (IDs only — secrets never live here).
      if (req.method === "GET" && url.pathname === "/api/tracking.json") {
        const t = (await getTracking(env)) ?? trackingFromSettings({});
        const h = publicJsonHeaders();
        return new Response(
          JSON.stringify({
            ga4_id: t.ga4_id,
            pixel_id: t.pixel_id,
            gsc_code: t.gsc_code,
            bing_code: t.bing_code,
            robots_index: t.robots_index,
            canonical_base: t.canonical_base,
            head_custom: t.head_custom,
            body_custom: t.body_custom,
          }),
          { status: 200, headers: h },
        );
      }
      // Public ads state for the SPA shell (slot toggles + publisher ID only).
      if (req.method === "GET" && url.pathname === "/api/ads.json") {
        const a = (await getAds(env)) ?? adsFromSettings({});
        const h = publicJsonHeaders();
        return new Response(
          JSON.stringify({ pubId: a.pubId, autoAds: a.autoAds, slots: a.slots }),
          { status: 200, headers: h },
        );
      }
      return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 404);
    }
    // DB-driven SEO pages (tool landing pages + /blog guides) render here.
    {
      const content = await handlePublicContent(req, env, url.pathname);
      if (content) return content;
    }
    // Built-in static SEO routes render server-side (no static prerender).
    {
      const content = await handleStaticSeo(req, env, url.pathname);
      if (content) return content;
    }
    // Canonical trailing-slash: strip (except root) with 308 before fallback.
    // (API paths never end in slash; asset files have extensions.)
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {
      const dest = canonicalPath(url.pathname) + url.search;
      return Response.redirect(new URL(dest, url.origin).toString(), 308);
    }
    // Admin SPA: client-side app served the shell with an HTTP-level noindex.
    // Asset routing has no SPA fallback, so this must be explicit.
    if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
      return adminShell(req, env);
    }
    // Static assets / SPA fallback.
    // File-like paths go to assets (their own 404s are normal).
    // Anything else unknown is a real 404 — never a soft-404 shell.
    if (!env.ASSETS) return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 404);
    if (!/\/[^/]+\.[a-z0-9]+$/i.test(url.pathname)) {
      return notFoundPage(siteUrl(env, req));
    }
    try {
      const res = await env.ASSETS.fetch(req);
      const h = new Headers(res.headers);
      securityHeaders().forEach((v, k) => {
        if (!h.has(k)) h.set(k, v);
      });
      return new Response(res.body, { status: res.status, headers: h });
    } catch {
      return err("UNKNOWN_ERROR", MESSAGES.UNKNOWN_ERROR, 500);
    }
  },
};
