/**
 * AdSense & Ads engine: publisher ID, auto-ads, and six placement toggles.
 * State lives in app_settings (DB) so placements apply without rebuild.
 */

export const AD_SLOTS = [
  "header",
  "below_search",
  "above_result",
  "midpage",
  "footer",
  "sticky",
] as const;

export type AdSlotName = (typeof AD_SLOTS)[number];

export interface AdsConfig {
  pubId: string;
  autoAds: boolean;
  slots: Record<AdSlotName, boolean>;
}

export function adsFromSettings(s: Record<string, string>): AdsConfig {
  const slots = {} as Record<AdSlotName, boolean>;
  for (const name of AD_SLOTS) {
    slots[name] = (s[`ad_slot_${name}`] ?? "false") === "true";
  }
  return {
    pubId: (s["adsense_pub_id"] || "").trim(),
    autoAds: (s["ads_auto"] ?? "false") === "true",
    slots,
  };
}

/** Ads are servable only with a valid publisher ID and at least one surface. */
export function adsActive(c: AdsConfig): boolean {
  if (!c.pubId) return false;
  return c.autoAds || AD_SLOTS.some((s) => c.slots[s]);
}

export function adsenseHeadHtml(c: AdsConfig): string {
  if (!c.pubId || !c.autoAds) return "";
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${c.pubId}" crossorigin="anonymous"></script>`;
}
