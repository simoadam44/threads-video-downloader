// Build-time fallback: emit static dist/client/sitemap.xml + robots.txt.
//
// Why: Workers Static Assets may serve real browser navigations (Sec-Fetch-Mode:
// navigate) directly from the asset layer. A static file guarantees those requests
// get valid XML/text even if they never reach the Worker. To keep the static copy
// complete, it is enriched at build time with the live DB slugs fetched from the
// published site's public indexes (/api/content/tools + /api/content/guides).
// No secrets are needed: those endpoints are public by design (live + light fields).
//
// Pure helpers (escapeXml/isSafeSlug/buildSitemapXml/buildRobotsTxt) are exported
// for unit tests; main() only runs when the script is executed directly.

import { buildSync } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist", "client");

export function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Mirrors the slug rules in src/server/content/types.ts (kept dependency-free
// so this script and its tests run without the app toolchain).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_AR_RE = /^[a-z0-9\u0600-\u06FF]+(?:[-_][a-z0-9\u0600-\u06FF]+)*$/u;

export function isSafeSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 120 && (SLUG_RE.test(slug) || SLUG_AR_RE.test(slug));
}

function lastmodOf(updatedAt) {
  const d = String(updatedAt || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `<lastmod>${d}</lastmod>` : "";
}

/**
 * Percent-encode non-ASCII path segments (Arabic slugs) so <loc> values are
 * unambiguous for every sitemap consumer. ASCII paths stay byte-identical.
 * Mirrors encodePath() in src/server/worker.ts so the static and Worker
 * sitemaps always emit the same URLs.
 */
export function encodeLoc(loc) {
  const m = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(String(loc));
  if (!m) return loc;
  const path = m[2] || "/";
  return (
    m[1] +
    path
      .split("/")
      .map((seg) => (/[^\x20-\x7E]/.test(seg) ? encodeURIComponent(seg) : seg))
      .join("/")
  );
}

/**
 * Merge static registry paths with live DB entries into one sitemap.
 * DB entries win on loc collisions (they carry fresher lastmod info).
 */
export function buildSitemapXml(origin, staticPaths, tools, guides) {
  const seen = new Set();
  const urls = [];
  const push = (loc, lastmod) => {
    const encoded = encodeLoc(loc);
    if (seen.has(encoded)) return;
    seen.add(encoded);
    urls.push(`  <url><loc>${escapeXml(encoded)}</loc>${lastmod}</url>`);
  };
  for (const t of tools) {
    if (!isSafeSlug(t?.slug)) continue;
    push(`${origin}/${t.slug}`, lastmodOf(t?.updated_at));
  }
  for (const g of guides) {
    if (!isSafeSlug(g?.slug)) continue;
    push(`${origin}/blog/${g.slug}`, lastmodOf(g?.updated_at));
  }
  for (const p of staticPaths) {
    push(`${origin}${p}`, "");
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`
  );
}

export function buildRobotsTxt(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ${origin}/sitemap.xml\n`;
}

/**
 * Read SITE_URL from the Wrangler config. `wrangler.jsonc` allows `//` comments,
 * so plain JSON.parse() throws on it — that silently fell back to the hardcoded
 * host and produced a sitemap/robots pair pointing at the wrong domain.
 * Only whole-line comments are stripped: the SITE_URL value itself contains
 * "https://", so a naive global comment regex would corrupt the JSON.
 */
export function readSiteUrlFromConfig(file) {
  try {
    const raw = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
    const v = (JSON.parse(raw)?.vars?.SITE_URL || "").trim().replace(/\/$/, "");
    if (v) return v;
  } catch {
    // fall through to default
  }
  return "https://www.savethreadsvideos.com";
}

function siteUrl() {
  return readSiteUrlFromConfig(join(root, "wrangler.jsonc"));
}

async function fetchList(base, path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base}${path}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json && Array.isArray(json.data) ? json.data : [];
    return data.filter((e) => e && isSafeSlug(e.slug)).slice(0, 500);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  // Bundle the dependency-free registry (it only uses `import type`) to a temp
  // file, import it, then remove the temp file (it must never ship in dist/).
  const tmpFile = join(tmpdir(), `seo-routes-${Date.now()}.cjs`);
  buildSync({
    entryPoints: [join(root, "src", "lib", "seo-routes.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: tmpFile,
    logLevel: "silent",
  });
  const { SEO_ROUTES } = await import(pathToFileURL(tmpFile).href);
  rmSync(tmpFile, { force: true });

  const origin = siteUrl();
  // Enrich with live DB slugs from the published site (override for previews).
  // Network/DB failures fall back to the static registry — never fail the build.
  const source = (process.env.SITEMAP_SOURCE_URL || origin).replace(/\/$/, "");
  const [tools, guides] = await Promise.all([fetchList(source, "/api/content/tools"), fetchList(source, "/api/content/guides")]);

  const xml = buildSitemapXml(
    origin,
    SEO_ROUTES.map((r) => r.path),
    tools,
    guides,
  );
  const robots = buildRobotsTxt(origin);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "sitemap.xml"), xml);
  writeFileSync(join(outDir, "robots.txt"), robots);
  const urlCount = (xml.match(/<url>/g) || []).length;
  console.log(`static SEO: ${urlCount} sitemap URLs (${tools.length} tools + ${guides.length} guides live) -> dist/client/{sitemap.xml,robots.txt}`);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  await main();
}
