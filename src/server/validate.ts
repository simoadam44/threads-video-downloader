import type { ApiErrorCode } from "../types";

const ALLOWED_HOSTS = new Set([
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
]);

export interface ValidationOk {
  ok: true;
  url: URL;
  normalized: string;
}
export interface ValidationFail {
  ok: false;
  code: ApiErrorCode;
}
export type Validation = ValidationOk | ValidationFail;

export function extractThreadsUrl(input: string): string | null {
  const m = input.match(/https?:\/\/[^\s"'<>`]+threads\.(net|com)[^\s"'<>`]*/i);
  if (!m) return null;
  return m[0].replace(/[),.;!?]+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost") return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "[::1]" || h === "::1") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

export function normalizeThreadsUrl(url: URL): string {
  const u = new URL(url.toString());
  u.hash = "";
  for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    u.searchParams.delete(p);
  }
  u.hostname = u.hostname.toLowerCase();
  return u.toString();
}

export function validateThreadsUrl(input: string): Validation {
  const raw = (input || "").trim();
  if (!raw || raw.length > 2048) return { ok: false, code: "INVALID_URL" };
  const candidate = raw.startsWith("http") ? raw : extractThreadsUrl(raw) ?? raw;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }
  if (url.protocol !== "https:") return { ok: false, code: "INVALID_URL" };
  if (url.username || url.password) return { ok: false, code: "INVALID_URL" };
  if (isBlockedHostname(url.hostname)) return { ok: false, code: "INVALID_URL" };
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return { ok: false, code: "UNSUPPORTED_URL" };
  if (!/\/(@[^/]+\/post\/[^/]+|post\/[^/]+|t\/[^/]+)/i.test(url.pathname)) {
    // Allow profile/post-ish paths but require some post identifier; be lenient for share variants
    if (url.pathname === "/" || url.pathname === "") return { ok: false, code: "UNSUPPORTED_URL" };
  }
  return { ok: true, url, normalized: normalizeThreadsUrl(url) };
}
