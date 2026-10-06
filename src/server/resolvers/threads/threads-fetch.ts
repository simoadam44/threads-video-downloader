/**
 * Fetch layer for public Threads post pages.
 * Ported technique from tribixbite/yt-dlp-threads (Unlicense): request the
 * public post page as a link-preview crawler so Meta server-renders the full
 * public payload into embedded JSON. This is a FRAGILE strategy: it only
 * reads publicly served content, uses no auth/cookies/CAPTCHA handling, and
 * every failure must degrade to a typed resolver error, never guessed data.
 */

const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export async function fetchPublicPostPage(url: URL): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "user-agent": CRAWLER_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (res.status === 404) {
      const { ResolverError } = await import("../types");
      throw new ResolverError("NOT_FOUND");
    }
    if (res.status === 403 || res.status === 401) {
      const { ResolverError } = await import("../types");
      throw new ResolverError("PRIVATE_CONTENT");
    }
    if (res.status === 429) {
      const { ResolverError } = await import("../types");
      throw new ResolverError("TEMPORARY_ERROR");
    }
    if (!res.ok) {
      const { ResolverError } = await import("../types");
      throw new ResolverError("RESOLVER_UNAVAILABLE");
    }
    // Redirect-chain pinning: a cross-host redirect means something changed
    // upstream — never read a body from an unapproved host.
    try {
      const finalHost = new URL(res.url).hostname.toLowerCase();
      if (finalHost !== "threads.net" && finalHost !== "www.threads.net" && finalHost !== "threads.com" && finalHost !== "www.threads.com") {
        const { ResolverError } = await import("../types");
        throw new ResolverError("RESOLVER_UNAVAILABLE");
      }
    } catch (e) {
      if (e && typeof e === "object" && "code" in (e as Record<string, unknown>)) throw e;
      const { ResolverError } = await import("../types");
      throw new ResolverError("RESOLVER_UNAVAILABLE");
    }
    // Stream with a hard cap: never buffer unbounded HTML into memory.
    const reader = res.body?.getReader();
    if (!reader) {
      const { ResolverError } = await import("../types");
      throw new ResolverError("RESOLVER_UNAVAILABLE");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PAGE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        const { ResolverError } = await import("../types");
        throw new ResolverError("RESOLVER_UNAVAILABLE");
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    return new TextDecoder().decode(merged);
  } catch (e) {
    if (e && typeof e === "object" && "code" in (e as Record<string, unknown>)) throw e;
    const { ResolverError } = await import("../types");
    throw new ResolverError("RESOLVER_UNAVAILABLE");
  } finally {
    clearTimeout(t);
  }
}

/** One retry with a small backoff for transient network failures only. */
export async function fetchWithOneRetry(url: URL): Promise<string> {
  try {
    return await fetchPublicPostPage(url);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "RESOLVER_UNAVAILABLE" || code === "TEMPORARY_ERROR") {
      await new Promise((r) => setTimeout(r, 1200));
      return fetchPublicPostPage(url);
    }
    throw e;
  }
}
