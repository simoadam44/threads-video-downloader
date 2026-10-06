/**
 * Client-side MP3 extraction from a video URL (e.g. our same-origin /api/dl).
 * Server-side conversion is impossible on Cloudflare Workers (no FFmpeg), so
 * decoding (Web Audio API) + MP3 encoding (lamejs, LGPL-3.0, dynamically
 * imported only when the user requests MP3) happen in the browser.
 */

export const MP3_MAX_SOURCE_BYTES = 50 * 1024 * 1024;

export type Mp3Stage = "fetch" | "decode" | "encode";

function floatToInt16(src: Float32Array): Int16Array {
  const out = new Int16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const s = Math.max(-1, Math.min(1, src[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function extractMp3(
  mediaUrl: string,
  onStage?: (stage: Mp3Stage) => void,
  maxBytes = MP3_MAX_SOURCE_BYTES,
): Promise<Blob> {
  onStage?.("fetch");
  const res = await fetch(mediaUrl);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !/^(video\/|audio\/)/.test(ct)) {
    throw new Error("MP3_SOURCE_FAILED");
  }
  const len = Number(res.headers.get("content-length") || "0");
  if (len > maxBytes) throw new Error("MP3_TOO_LARGE");
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > maxBytes) throw new Error("MP3_TOO_LARGE");

  onStage?.("decode");
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    // decodeAudioData detaches the buffer; copy first for safety.
    const audio = await ctx.decodeAudioData(buf.slice(0));
    if (!audio || audio.numberOfChannels < 1 || audio.length === 0) throw new Error("MP3_DECODE_FAILED");
    const channels = Math.min(audio.numberOfChannels, 2);
    const left = floatToInt16(audio.getChannelData(0));
    const right = channels === 2 ? floatToInt16(audio.getChannelData(1)) : undefined;

    onStage?.("encode");
    const { Mp3Encoder } = await import("@breezystack/lamejs");
    const encoder = new Mp3Encoder(channels, audio.sampleRate, 128);
    const parts: Uint8Array[] = [];
    const CHUNK = 1152;
    for (let i = 0; i < left.length; i += CHUNK) {
      const l = left.subarray(i, i + CHUNK);
      const r = right ? right.subarray(i, i + CHUNK) : undefined;
      const data = channels === 2 ? encoder.encodeBuffer(l, r as Int16Array) : encoder.encodeBuffer(l);
      if (data.length > 0) parts.push(new Uint8Array(data));
    }
    const end = encoder.flush();
    if (end.length > 0) parts.push(new Uint8Array(end));
    // @ts-expect-error BlobPart compatibility across DOM lib versions
    return new Blob(parts, { type: "audio/mpeg" });
  } finally {
    void ctx.close().catch(() => {});
  }
}

export function mp3Filename(postId: string): string {
  const id = (postId || "post").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 64) || "post";
  return `threads-audio-${id}.mp3`;
}
