/**
 * Normalization of Threads post JSON into the app's ResolvedPost/MediaItem.
 * Field mapping ported from tribixbite/yt-dlp-threads `ThreadsIE` (Unlicense):
 * video_versions[] (deduped by URL path), image_versions2.candidates[]
 * (full images with width/height), carousel_media[] items, caption.text,
 * user.username, taken_at. Duration decoded from the CDN `efg` base64 param
 * (Threads exposes it nowhere else). Image/carousel support proven by the
 * same embedded structures the plugin parses for thumbnails.
 */
import type { MediaItem, ResolvedPost } from "../../../types";
import type { PostDict } from "./threads-parser";

const MEDIA_TYPE_IMAGE = 1;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function httpsUrl(v: unknown): string | undefined {
  const s = str(v);
  return s && s.startsWith("https://") ? s : undefined;
}

function decodeEfgDuration(url: string): number | undefined {
  try {
    const q = new URL(url).searchParams.get("efg");
    if (!q) return undefined;
    const padded = q + "=".repeat((4 - (q.length % 4)) % 4);
    const json = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))) as { duration_s?: unknown };
    return typeof json.duration_s === "number" ? Math.round(json.duration_s) : undefined;
  } catch {
    return undefined;
  }
}

function imageItems(media: PostDict, idPrefix: string): MediaItem[] {
  const out: MediaItem[] = [];
  const cands = (media["image_versions2"] as { candidates?: unknown })?.candidates;
  if (Array.isArray(cands)) {
    cands.forEach((c, i) => {
      const rec = c as Record<string, unknown>;
      const url = httpsUrl(rec["url"]);
      if (!url) return;
      out.push({
        id: `${idPrefix}-img-${i}`,
        type: "image",
        url,
        thumbnail: url,
        width: num(rec["width"]),
        height: num(rec["height"]),
        mimeType: "image/jpeg",
        extension: "jpg",
      });
    });
  }
  // Dedupe identical assets (re-signed query variants): compare by URL path.
  const seen = new Set<string>();
  return out.filter((m) => {
    const path = m.url.split("?")[0];
    if (seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function videoItems(media: PostDict, idPrefix: string, fallbackW?: number, fallbackH?: number): MediaItem[] {
  const out: MediaItem[] = [];
  const versions = media["video_versions"];
  if (!Array.isArray(versions)) return out;
  const seen = new Set<string>();
  const silent = media["has_audio"] === false;
  versions.forEach((v, i) => {
    const rec = v as Record<string, unknown>;
    const url = httpsUrl(rec["url"]);
    if (!url) return;
    const path = url.split("?")[0];
    if (seen.has(path)) return; // same asset re-signed (type 101/102/103)
    seen.add(path);
    out.push({
      id: `${idPrefix}-video-${i}`,
      type: "video",
      url,
      width: num(rec["width"]) ?? fallbackW,
      height: num(rec["height"]) ?? fallbackH,
      duration: decodeEfgDuration(url),
      mimeType: "video/mp4",
      quality: typeof rec["type"] === "number" || typeof rec["type"] === "string" ? String(rec["type"]) : "best",
      extension: "mp4",
    });
    void silent;
  });
  return out;
}

function thumbnailsFrom(media: PostDict): string | undefined {
  const cands = (media["image_versions2"] as { candidates?: unknown })?.candidates;
  if (Array.isArray(cands)) {
    for (const c of cands) {
      const url = httpsUrl((c as Record<string, unknown>)["url"]);
      if (url) return url;
    }
  }
  return undefined;
}

export function normalizePost(post: PostDict, postUrl: string, urlUsername: string | null): ResolvedPost | null {
  const code = str(post["code"]) ?? "post";
  const user = (post["user"] as Record<string, unknown>) ?? {};
  const username = str(user["username"]) ?? urlUsername ?? undefined;
  const caption =
    str((post["caption"] as Record<string, unknown>)?.["text"]) ?? str(post["accessibility_caption"]) ?? undefined;

  const items: MediaItem[] = [];
  const carousel = post["carousel_media"];
  if (Array.isArray(carousel) && carousel.length > 0) {
    carousel.forEach((item, idx) => {
      const m = item as PostDict;
      const vids = videoItems(m, `${code}-${idx + 1}`, num(m["original_width"]), num(m["original_height"]));
      const imgs = imageItems(m, `${code}-${idx + 1}`);
      if (vids.length > 0) {
        // A video entry's images are its posters, not separate downloads.
        if (!vids[0].thumbnail && imgs[0]) vids[0].thumbnail = imgs[0].url;
        items.push(...vids);
      } else {
        items.push(...imgs);
      }
    });
  } else {
    items.push(
      ...videoItems(post, code, num(post["original_width"]), num(post["original_height"])),
      ...imageItems(post, code),
    );
  }
  if (items.length === 0) {
    // Link-attachment posts (e.g. media_type 19) carry no native media, only
    // a link preview. Offer the preview image honestly labeled as such.
    const attachment = (post["text_post_app_info"] as Record<string, unknown> | undefined)?.[
      "link_preview_attachment"
    ] as Record<string, unknown> | undefined;
    const previewUrl = httpsUrl(attachment?.["image_url"]);
    if (previewUrl) {
      items.push({
        id: `${code}-link-preview`,
        type: "image",
        url: previewUrl,
        thumbnail: previewUrl,
        mimeType: "image/jpeg",
        quality: "preview",
        extension: "jpg",
      });
    }
  }
  if (items.length === 0) return null;

  const firstVideo = items.find((m) => m.type === "video");
  return {
    postUrl,
    postId: code,
    username,
    profileUrl: username ? `https://www.threads.net/@${username}` : undefined,
    caption: caption?.slice(0, 500),
    thumbnail: thumbnailsFrom(post) ?? firstVideo?.thumbnail,
    mediaItems: items.slice(0, 20).map((m, i) => {
      if (m.type === "video" && i === 0 && items.filter((x) => x.type === "video").length === 1) {
        return { ...m, quality: "best" };
      }
      return m;
    }),
  };
}

export function isImageOnlyPost(post: PostDict): boolean {
  return post["media_type"] === MEDIA_TYPE_IMAGE;
}
