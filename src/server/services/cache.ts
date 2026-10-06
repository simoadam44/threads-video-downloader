export class MemoryCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number) {}
  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.store.size > 500) {
      const first = this.store.keys().next().value as string;
      this.store.delete(first);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export async function cacheKey(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
