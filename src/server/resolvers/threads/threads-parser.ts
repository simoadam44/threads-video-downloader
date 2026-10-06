/**
 * Parser for Threads embedded post JSON.
 * Algorithm ported from tribixbite/yt-dlp-threads `ThreadsIE` (Unlicense):
 * collect every `<script type="application/json">` block, JSON-parse each
 * (one bad blob must not fail the whole page), recursively gather dicts that
 * carry a `code` plus a media key, then select STRICTLY by shortcode.
 * Never fall back to another post: wrong-post media is worse than no media.
 */

const MEDIA_KEYS = new Set(["video_versions", "video_dash_manifest", "image_versions2", "carousel_media"]);

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
export type PostDict = Record<string, JsonValue>;

export function extractJsonBlocks(html: string): string[] {
  const out: string[] = [];
  const re = /<script type="application\/json"[^>]*>(.*?)<\/script>/gs;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(html)) !== null && guard++ < 500) {
    out.push(m[1]);
  }
  return out;
}

function isPostDict(obj: JsonValue): obj is PostDict {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  const rec = obj as Record<string, JsonValue>;
  if (typeof rec["code"] !== "string" || !rec["code"]) return false;
  return Object.keys(rec).some((k) => MEDIA_KEYS.has(k));
}

function collect(obj: JsonValue, out: PostDict[]): void {
  // Iterative to avoid stack overflow on huge pages.
  const stack: JsonValue[] = [obj];
  let guard = 0;
  while (stack.length > 0 && guard++ < 200_000) {
    const cur = stack.pop() as JsonValue;
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (typeof cur === "object" && cur !== null) {
      if (isPostDict(cur)) out.push(cur as PostDict);
      for (const v of Object.values(cur)) stack.push(v as JsonValue);
    }
  }
}

export function collectPosts(html: string): PostDict[] {
  const posts: PostDict[] = [];
  for (const block of extractJsonBlocks(html)) {
    try {
      collect(JSON.parse(block) as JsonValue, posts);
    } catch {
      // Unrelated/malformed blobs are normal on Threads pages. Skip.
    }
  }
  return posts;
}

export function selectPost(posts: PostDict[], shortcode: string | null): PostDict | null {
  if (shortcode) {
    return posts.find((p) => p["code"] === shortcode) ?? null;
  }
  // No shortcode (unresolvable link form): only safe choice is a page with a
  // single candidate; otherwise refuse rather than guess.
  return posts.length === 1 ? posts[0] : null;
}

export function shortcodeFromOgUrl(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  if (!m) return null;
  const u = m[1].match(/\/post\/([\w-]+)/);
  return u ? u[1] : null;
}

export function shortcodeFromUrl(url: URL): { shortcode: string | null; username: string | null } {
  const userPost = url.pathname.match(/@([^/]+)\/post\/([\w-]+)/);
  if (userPost) return { shortcode: userPost[2], username: userPost[1] };
  const t = url.pathname.match(/^\/t\/([\w-]+)/);
  if (t) return { shortcode: t[1], username: null };
  return { shortcode: null, username: null }; // /share/ etc: resolve via og:url
}
