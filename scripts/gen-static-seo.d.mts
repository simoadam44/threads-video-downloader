// Types for the testable pure helpers in gen-static-seo.mjs (kept in sync).
export function escapeXml(s: unknown): string;
export function isSafeSlug(slug: unknown): boolean;
export function buildSitemapXml(
  origin: string,
  staticPaths: string[],
  tools: { slug?: unknown; updated_at?: unknown }[],
  guides: { slug?: unknown; updated_at?: unknown }[],
): string;
export function buildRobotsTxt(origin: string): string;
export function encodeLoc(loc: unknown): string;
export function readSiteUrlFromConfig(file: string): string;
