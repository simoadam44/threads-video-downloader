function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 64) || "media";
}

export function mediaFilename(
  kind: "video" | "image" | "media",
  postId: string,
  index: number,
  ext: string,
): string {
  const id = sanitize(postId);
  const e = sanitize(ext).toLowerCase() || (kind === "video" ? "mp4" : "jpg");
  if (kind === "video" && index <= 0) return `threads-video-${id}.${e}`;
  if (kind === "image") return `threads-image-${id}-${index}.${e}`;
  return `threads-media-${id}-${index}.${e}`;
}

export function extensionFromMime(mimeType: string | undefined, fallback: string): string {
  if (!mimeType) return fallback;
  const m = mimeType.toLowerCase();
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("jpeg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  return fallback;
}
