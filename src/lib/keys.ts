/**
 * Shared API-key sanitizer (client + Worker — never duplicate this logic).
 *
 * Copy-paste from web UIs (especially under RTL layouts) routinely injects
 * invisible characters: spaces, newlines, zero-width spaces, BOM and bidi
 * direction marks. No valid API key ever contains any of these, so stripping
 * them is always safe and prevents "invalid key" false rejections.
 */

const INVISIBLE_RE = /[\s\u200B-\u200F\uFEFF\u202A-\u202E\u2066-\u2069]+/g;

export function sanitizeApiKey(input: unknown): string {
  return String(input ?? "").replace(INVISIBLE_RE, "");
}
