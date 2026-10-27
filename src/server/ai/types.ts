/**
 * AI content-draft generation — provider abstraction (mirrors the resolver
 * pattern so the front-end/admin never knows which provider runs).
 *
 * Only the free Gemini API tier is wired today; the interface allows other
 * providers later without touching worker routes or the admin UI.
 */

export type AiLang = "en" | "fr" | "ar";
export type AiKind = "tool" | "guide";

import { DEFAULT_AI_MODEL, GEMINI_MODELS } from "../../lib/ai-models";

export interface AiFaq {
  q: string;
  a: string;
}

/**
 * Uniqueness context assembled by the caller (Worker) from the database:
 * existing titles + FAQ questions the new draft must differ from, plus the
 * pool of slugs the draft may link to internally.
 */
export interface AiContext {
  existingTitles: string[];
  existingFaqQuestions: string[];
  /** Bare slugs (tool + guide) valid for the draft's related_slugs field. */
  allowedSlugs: string[];
  /** Full internal paths ("/slug", "/blog/slug") for guide body links. */
  linkPaths: string[];
}

export interface AiRequest {
  kind: AiKind;
  targetKeyword: string;
  lang: AiLang;
  context: AiContext;
}

export interface AiToolDraft {
  kind: "tool";
  slug: string;
  badge: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  faqs: AiFaq[];
  related_slugs: string[];
}

export interface AiGuideDraft {
  kind: "guide";
  slug: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  faqs: AiFaq[];
  related_slugs: string[];
}

export type AiDraft = AiToolDraft | AiGuideDraft;

export type AiErrorCode =
  | "AI_NOT_CONFIGURED" // missing/invalid API key
  | "AI_QUOTA" // free-tier quota / upstream rate limit
  | "AI_UPSTREAM" // upstream/model/timeout/network failure
  | "AI_BAD_OUTPUT"; // unusable model output (unparseable or empty)

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    /** Sanitized upstream detail (admin eyes only — never contains keys). */
    public detail?: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiProvider {
  readonly name: string;
  generate(req: AiRequest): Promise<AiDraft>;
}

/** Models the admin UI may choose (all available on the free tier). */
export { GEMINI_MODELS, DEFAULT_AI_MODEL };

/** Safe display form: never returns the full key. */
export function maskApiKey(key: string): string {
  const k = (key || "").trim();
  if (!k) return "";
  if (k.length <= 8) return `${k.slice(0, 2)}…`;
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Slug form the DB accepts (latin or Arabic), with reserved names avoided. */
export function sanitizeSlug(input: string, fallback: string): string {
  const clean = (s: string) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/['"`]/g, "")
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  const out = clean(input).length >= 3 ? clean(input) : clean(fallback);
  // Always return a DB-valid slug: prefix when needed, strip stray hyphens,
  // and fall back to a deterministic placeholder as a last resort.
  const prefixed = /^[a-z0-9\u0600-\u06FF]/u.test(out) ? out : `page-${out}`;
  const final = prefixed.replace(/^-+|-+$/g, "").slice(0, 80);
  return final.length >= 3 ? final : "ai-draft";
}
