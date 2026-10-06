import type { ToolPage, ToolPageInput, Guide, GuideInput } from "../content/types";
import { validateTrackingSetting } from "../content/tracking";

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

export interface ResolveEventInput {
  urlHash: string;
  status: string;
  mediaCount: number;
  ipHash?: string;
  userAgent?: string;
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
]);

export function validateSetting(key: string, value: string): boolean {
  if (!ALLOWED_SETTINGS.has(key)) return false;
  if (typeof value !== "string") return false;
  if (TRACKING_KEYS.has(key)) return validateTrackingSetting(key, value) === null;
  if (key === "adsense_pub_id") {
    return value === "" || /^ca-pub-\d{10,20}$/.test(value);
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
