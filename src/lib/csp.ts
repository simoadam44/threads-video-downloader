/**
 * Content-Security-Policy hash for the inline anti-FOUC theme bootstrap that
 * ships in index.html.
 *
 * `script-src 'self'` blocks inline scripts, which silently killed that script:
 * a stored/preferred dark theme was ignored until React mounted (wrong-theme
 * flash). A hash keeps HTML responses cacheable, unlike a per-request nonce.
 *
 * Keep in sync with the inline <script> in index.html — tests/seo-audit.test.ts
 * recomputes the hash and fails if it drifts.
 */
export const THEME_SCRIPT_HASH = "'sha256-pPKNV4anvsXv/1vrkvNtn1mNBQCiOUl8urGs8dQCHhM='";

export interface CspSources {
  /** Extra script hosts (analytics/ads vendors), CSP-quoted. */
  scriptSrc?: string[];
  connectSrc?: string[];
  imgSrc?: string[];
  /**
   * Vite dev injects its own inline scripts (React Refresh preamble, HMR
   * client) and needs eval for source maps, so the production policy would
   * break `npm run dev` (hydration dies with "can't detect preamble").
   */
  isDev: boolean;
}

/**
 * Build the Content-Security-Policy value, or `null` when no policy should be
 * sent (dev server). Production callers pass vendor sources only when those
 * integrations are actually configured.
 */
export function cspHeaderValue(sources: CspSources): string | null {
  if (sources.isDev) return null;
  const scriptSrc = ["'self'", THEME_SCRIPT_HASH, ...(sources.scriptSrc ?? [])];
  const connectSrc = ["'self'", ...(sources.connectSrc ?? [])];
  const imgSrc = ["'self'", "https:", "data:", ...(sources.imgSrc ?? [])];
  return (
    `default-src 'self'; img-src ${imgSrc.join(" ")}; media-src 'self' https:; ` +
    `style-src 'self' 'unsafe-inline'; script-src ${scriptSrc.join(" ")}; ` +
    `connect-src ${connectSrc.join(" ")}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  );
}
