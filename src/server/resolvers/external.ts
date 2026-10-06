import type { ResolvedPost } from "../../types";
import type { MediaResolverProvider } from "./types";
import { ResolverError } from "./types";

interface Env {
  MEDIA_RESOLVER_API_URL?: string;
  MEDIA_RESOLVER_API_KEY?: string;
}

/**
 * Adapter for a generic external resolver API. Never called client-side.
 * Expected upstream contract: POST { url } -> { post..., mediaItems[] }.
 * Normalize defensively; never leak upstream status/body to clients.
 */
export class ExternalResolver implements MediaResolverProvider {
  name = "external";
  constructor(private env: Env) {}
  canHandle(): boolean {
    return true;
  }
  async resolve(url: URL, normalized: string): Promise<ResolvedPost> {
    const base = this.env.MEDIA_RESOLVER_API_URL?.trim();
    const key = this.env.MEDIA_RESOLVER_API_KEY?.trim();
    if (!base || !key) throw new ResolverError("RESOLVER_UNAVAILABLE");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(base.replace(/\/$/, "") + "/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ url: normalized }),
        signal: ctrl.signal,
      });
      if (res.status === 404) throw new ResolverError("NOT_FOUND");
      if (res.status === 403) throw new ResolverError("PRIVATE_CONTENT");
      if (res.status === 429) throw new ResolverError("TEMPORARY_ERROR");
      if (!res.ok) throw new ResolverError("RESOLVER_UNAVAILABLE");
      const json = (await res.json()) as Partial<ResolvedPost>;
      if (!json || !Array.isArray(json.mediaItems)) throw new ResolverError("MEDIA_NOT_FOUND");
      const items = json.mediaItems
        .filter((m) => m && typeof m.url === "string" && m.url.startsWith("https://"))
        .slice(0, 20)
        .map((m, i) => ({
          id: String(m.id ?? `ext-${i}`),
          type: (["video", "image", "gif", "audio"] as const).includes(m.type as never)
            ? (m.type as ResolvedPost["mediaItems"][number]["type"])
            : ("image" as const),
          url: m.url,
          thumbnail: typeof m.thumbnail === "string" ? m.thumbnail : undefined,
          width: typeof m.width === "number" ? m.width : undefined,
          height: typeof m.height === "number" ? m.height : undefined,
          duration: typeof m.duration === "number" ? m.duration : undefined,
          mimeType: typeof m.mimeType === "string" ? m.mimeType : undefined,
          quality: typeof m.quality === "string" ? m.quality : undefined,
          extension: typeof m.extension === "string" ? m.extension : undefined,
        }));
      if (items.length === 0) throw new ResolverError("MEDIA_NOT_FOUND");
      return {
        postUrl: normalized,
        postId: typeof json.postId === "string" ? json.postId.slice(0, 64) : undefined,
        username: typeof json.username === "string" ? json.username.slice(0, 64) : undefined,
        profileUrl: typeof json.profileUrl === "string" ? json.profileUrl.slice(0, 256) : undefined,
        caption: typeof json.caption === "string" ? json.caption.slice(0, 500) : undefined,
        thumbnail: typeof json.thumbnail === "string" ? json.thumbnail.slice(0, 512) : undefined,
        mediaItems: items,
      };
    } catch (e) {
      if (e instanceof ResolverError) throw e;
      throw new ResolverError("RESOLVER_UNAVAILABLE");
    } finally {
      clearTimeout(t);
    }
    void url;
  }
}
