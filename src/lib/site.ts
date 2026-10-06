export const SITE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SITE_URL) ||
  "https://www.savethreadsvideos.com";

export function canonicalFor(path: string): string {
  const p = path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return SITE_URL.replace(/\/$/, "") + p;
}
