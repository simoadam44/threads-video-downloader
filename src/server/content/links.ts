/**
 * Render-time repair for admin-authored content links.
 *
 * Why this exists
 * ---------------
 * The blog engine stored a handful of broken anchors (documented in
 * `docs/seo-diagnosis-2026-11-18.md` §9):
 * - links to pages that now answer 301 (`/threads-video-downloader-hd`,
 *   `/threads-video-downloader-web-utility`, `/blog/threads-to-mp4-conversion-guide`, …);
 * - closing tags saved as `<a href="/">`, which produced nested/unclosed
 *   anchors on the Android and PC guides;
 * - absolute same-site URLs mixed into otherwise relative body copy.
 *
 * The database rows are never mutated (no migrations, no row edits, no
 * deletions), so the correction happens on the way out, in `renderGuide`.
 * Every transform is idempotent and leaves already-valid content untouched:
 * external links, fragments, `mailto:`/`tel:` and live internal paths are
 * returned byte-for-byte.
 */
import { GONE_PATHS, RETIRED_GUIDE_SLUGS, RETIRED_TOOL_SLUGS, isGonePath } from "./redirects";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Absolute URL on this site → root-relative path. Returns null for anything
 * that must be left alone (external hosts, fragments, protocol-relative URLs,
 * `mailto:`/`tel:` and bare relative paths).
 */
function toLocalPath(href: string, hosts: Set<string>): string | null {
  const value = href.trim();
  if (!value || value.startsWith("//")) return null;
  if (value.startsWith("/")) return value;
  if (!/^https?:\/\//i.test(value) || hosts.size === 0) return null;
  try {
    const url = new URL(value);
    return hosts.has(url.host.toLowerCase()) ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

/**
 * Final 200 destination for a retired DB page, or null when the path is live
 * (or is a nested/unknown path that the redirect map ignores).
 */
function retiredTarget(local: string): string | null {
  const [path] = local.split("?");
  if (!path.startsWith("/") || path === "/" || isGonePath(path)) return null;
  if (path.startsWith("/blog/")) {
    const slug = path.slice("/blog/".length);
    if (!slug || slug.includes("/")) return null;
    return RETIRED_GUIDE_SLUGS[slug] ?? null;
  }
  const slug = path.slice(1);
  if (!slug || slug.includes("/")) return null;
  return RETIRED_TOOL_SLUGS[slug] ?? null;
}

const ANCHOR_RE = /<a\b[^>]*>|<\/a\s*>/gi;
/** The content engine saved `</a>` as `<a href="/">`; treat it as a closer. */
const BROKEN_CLOSER_RE = /^<a\b[^>]*\bhref\s*=\s*["']\/["'][^>]*>$/i;

/**
 * Keep the anchor stack valid: a pseudo-closer (`<a href="/">`) that appears
 * while an anchor is open becomes `</a>`; genuinely nested anchors are split
 * into siblings; stray closing tags are dropped and any anchor left open is
 * closed at the end.
 */
function balanceAnchors(html: string): string {
  const parts: string[] = [];
  let open = 0;
  let index = 0;
  ANCHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    parts.push(html.slice(index, match.index));
    const tag = match[0];
    if (/^<\/a/i.test(tag)) {
      if (open > 0) {
        parts.push(tag);
        open -= 1;
      }
    } else if (open === 0) {
      parts.push(tag);
      open = 1;
    } else if (BROKEN_CLOSER_RE.test(tag)) {
      parts.push("</a>");
      open = 0;
    } else {
      parts.push("</a>", tag);
      open = 1;
    }
    index = ANCHOR_RE.lastIndex;
  }
  parts.push(html.slice(index));
  let out = parts.join("");
  if (open > 0) out += "</a>".repeat(open);
  return out;
}

/**
 * Repair one stored HTML fragment for rendering.
 *
 * @param html   Stored `guide.body` (already passed through `sanitizeGuideHtml`).
 * @param origin Canonical origin of the site, e.g. `https://www.example.com`.
 */
export function repairContentLinks(html: string, origin: string): string {
  if (!html) return html;

  let host = "";
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    host = "";
  }
  const hosts = new Set<string>();
  if (host) {
    hosts.add(host);
    hosts.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
  }

  let out = html;

  // 1) Anchors to an intentionally removed page keep their text but lose the
  //    link: no destination can honour that intent.
  for (const gone of GONE_PATHS) {
    out = out.replace(
      new RegExp(
        `<a\\b[^>]*\\bhref\\s*=\\s*"(?:https?:\\/\\/[^"]*)?${escapeRegExp(gone)}"[^>]*>([\\s\\S]*?)<\\/a\\s*>`,
        "gi",
      ),
      (_m, text: string) => text,
    );
  }

  // 2) Same-site absolute URLs → root-relative (the site is single-host), and
  //    retired pages → their final 200 URL so the reader skips a 301 hop.
  out = out.replace(/href\s*=\s*"([^"]*)"/gi, (full, raw: string) => {
    const local = toLocalPath(raw, hosts);
    if (local === null) return full;
    const target = retiredTarget(local) ?? local;
    return `href="${target}"`;
  });

  // 3) Re-balance anchors after the href pass.
  return balanceAnchors(out);
}
