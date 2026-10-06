/**
 * Single-use opaque download tokens. The Worker never exposes an open
 * `?url=` proxy: only URLs the server itself resolved can be downloaded,
 * referenced by an unguessable token with a short TTL.
 */

interface Entry {
  url: string;
  filename: string;
  expires: number;
  /** Post context for self-healing: re-resolve fresh URLs when signatures expire. */
  postUrl?: string;
  itemId?: string;
}

const TOKEN_TTL_MS = 5 * 60 * 1000;
const store = new Map<string, Entry>();

export function issueDownloadToken(
  url: string,
  filename: string,
  postUrl?: string,
  itemId?: string,
): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  // Opportunistic expiry sweep (store is tiny).
  for (const [k, v] of store) {
    if (v.expires <= now) store.delete(k);
  }
  if (store.size > 1000) {
    const first = store.keys().next().value as string;
    store.delete(first);
  }
  store.set(token, { url, filename, expires: now + TOKEN_TTL_MS, postUrl, itemId });
  return token;
}

export function lookupDownloadToken(token: string): Entry | null {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const e = store.get(token);
  if (!e) return null;
  if (Date.now() > e.expires) {
    store.delete(token);
    return null;
  }
  return { url: e.url, filename: e.filename, expires: e.expires, postUrl: e.postUrl, itemId: e.itemId };
}
