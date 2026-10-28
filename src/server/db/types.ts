import type { ToolPage, ToolPageInput, Guide, GuideInput } from "../content/types";
import { validateTrackingSetting } from "../content/tracking";
import { GEMINI_MODELS } from "../../lib/ai-models";

const TRACKING_KEYS = new Set([
  "ga4_id",
  "gsc_code",
  "bing_code",
  "pixel_id",
  "robots_index",
  "canonical_base",
  "head_custom",
  "body_custom",
]);

const AD_SLOT_KEYS = new Set([
  "ad_slot_header",
  "ad_slot_below_search",
  "ad_slot_above_result",
  "ad_slot_midpage",
  "ad_slot_footer",
  "ad_slot_sticky",
]);

// AI content generation (free Gemini tier). The key is write-only through the
// admin settings API — GET masks it via ai/maskApiKey.
// GEMINI_MODELS is shared (src/lib/ai-models.ts) so the admin UI dropdown and
// the server validation can never drift apart.

// Gemini keys come in two formats (Oct 2026): legacy Standard keys
// ("AIza…", deprecated by Google since Sep 2026) and the current Auth keys
// ("AQ.…", the only format AI Studio issues now). Accept both; Google itself
// is the final judge (a wrong key surfaces as a friendly error at generation).
const GEMINI_KEY_RE = /^(AIza[0-9A-Za-z_\-]{10,120}|AQ\.[0-9A-Za-z_\-.]{10,200})$/;

export interface ResolveEventInput {
  urlHash: string;
  status: string;
  mediaCount: number;
  ipHash?: string;
  userAgent?: string;
}

/**
 * Contact form messages. Stored because the site has no mail provider
 * configured: the operator reads them in the admin inbox. Only the four
 * visitor-provided fields plus hashed request metadata are kept.
 */
export interface ContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipHash?: string;
  userAgent?: string;
}

export interface ContactMessage extends ContactMessageInput {
  id: number;
  created_at: string;
}

export interface StatsSummary {
  total: number;
  success: number;
  errors: number;
  rateLimited: number;
  last24h: number;
  recent: {
    id: number;
    created_at: string;
    status: string;
    media_count: number;
  }[];
}

/** Storage abstraction: one implementation (Supabase) works local + cloud via env. */
export interface DbProvider {
  logEvent(e: ResolveEventInput): Promise<void>;
  getStats(): Promise<StatsSummary>;
  listEvents(limit: number, offset: number): Promise<StatsSummary["recent"]>;
  getSettings(): Promise<Record<string, string>>;
  updateSetting(key: string, value: string): Promise<void>;
  // SEO content engines
  listToolPages(): Promise<ToolPage[]>;
  getToolPage(id: number): Promise<ToolPage | null>;
  getToolPageBySlug(slug: string): Promise<ToolPage | null>;
  createToolPage(input: ToolPageInput): Promise<ToolPage>;
  updateToolPage(id: number, input: ToolPageInput): Promise<ToolPage | null>;
  deleteToolPage(id: number): Promise<boolean>;
  listGuides(): Promise<Guide[]>;
  getGuide(id: number): Promise<Guide | null>;
  getGuideBySlug(slug: string): Promise<Guide | null>;
  createGuide(input: GuideInput): Promise<Guide>;
  updateGuide(id: number, input: GuideInput): Promise<Guide | null>;
  deleteGuide(id: number): Promise<boolean>;
  listLiveSlugs(): Promise<{ kind: "tool" | "guide"; slug: string; updated_at: string }[]>;
  // Contact inbox (written by the public contact form, read in the admin area)
  createContactMessage(input: ContactMessageInput): Promise<ContactMessage>;
  listContactMessages(limit: number, offset: number): Promise<ContactMessage[]>;
  deleteContactMessage(id: number): Promise<boolean>;
}

export const ALLOWED_SETTINGS = new Set([
  "resolver_provider",
  "resolve_limit",
  "ads_enabled",
  "analytics_enabled",
  // SEO & Webmaster engine
  "ga4_id",
  "gsc_code",
  "bing_code",
  "pixel_id",
  "robots_index",
  "canonical_base",
  "head_custom",
  "body_custom",
  // AdSense & Ads engine
  "adsense_pub_id",
  "ads_auto",
  "ad_slot_header",
  "ad_slot_below_search",
  "ad_slot_above_result",
  "ad_slot_midpage",
  "ad_slot_footer",
  "ad_slot_sticky",
  // AI content generator (write-only key — masked in GET responses)
  "gemini_api_key",
  "gemini_model",
]);

export function validateSetting(key: string, value: string): boolean {
  if (!ALLOWED_SETTINGS.has(key)) return false;
  if (typeof value !== "string") return false;
  if (TRACKING_KEYS.has(key)) return validateTrackingSetting(key, value) === null;
  if (key === "adsense_pub_id") {
    return value === "" || /^ca-pub-\d{10,20}$/.test(value);
  }
  if (key === "gemini_api_key") {
    return value === "" || GEMINI_KEY_RE.test(value);
  }
  if (key === "gemini_model") {
    return (GEMINI_MODELS as readonly string[]).includes(value);
  }
  if (key === "ads_auto" || AD_SLOT_KEYS.has(key)) {
    return value === "true" || value === "false";
  }
  if (value.length === 0 || value.length > 512) return false;
  if (key === "resolver_provider" && value !== "mock" && value !== "opensource" && value !== "external") return false;
  if (key === "resolve_limit") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 600) return false;
  }
  if ((key === "ads_enabled" || key === "analytics_enabled") && value !== "true" && value !== "false") {
    return false;
  }
  return true;
}
