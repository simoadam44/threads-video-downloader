import { describe, it, expect } from "vitest";
import { adsFromSettings, adsActive, adsenseHeadHtml, AD_SLOTS } from "../src/server/content/ads";
import { validateSetting } from "../src/server/db/types";

describe("ads setting validation", () => {
  it("accepts valid publisher IDs and empty", () => {
    expect(validateSetting("adsense_pub_id", "ca-pub-9920194819284102")).toBe(true);
    expect(validateSetting("adsense_pub_id", "")).toBe(true);
  });
  it("rejects malformed IDs", () => {
    expect(validateSetting("adsense_pub_id", "pub-123")).toBe(false);
    expect(validateSetting("adsense_pub_id", "ca-pub-abc")).toBe(false);
    expect(validateSetting("adsense_pub_id", "ca-pub-123<script>")).toBe(false);
  });
  it("accepts slot toggles and auto flag only as booleans", () => {
    for (const s of [...AD_SLOTS.map((n) => `ad_slot_${n}`), "ads_auto"]) {
      expect(validateSetting(s, "true")).toBe(true);
      expect(validateSetting(s, "false")).toBe(true);
      expect(validateSetting(s, "yes")).toBe(false);
      expect(validateSetting(s, "")).toBe(false);
    }
  });
});

describe("ads config", () => {
  it("parses settings and detects active state", () => {
    const off = adsFromSettings({});
    expect(off.pubId).toBe("");
    expect(adsActive(off)).toBe(false);
    const on = adsFromSettings({ adsense_pub_id: "ca-pub-9920194819284102", ad_slot_header: "true" });
    expect(on.slots.header).toBe(true);
    expect(on.slots.footer).toBe(false);
    expect(adsActive(on)).toBe(true);
  });
  it("emits auto-ads script only when enabled with ID", () => {
    expect(adsenseHeadHtml(adsFromSettings({}))).toBe("");
    expect(
      adsenseHeadHtml(adsFromSettings({ adsense_pub_id: "ca-pub-9920194819284102", ads_auto: "true" })),
    ).toContain("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9920194819284102");
    expect(
      adsenseHeadHtml(adsFromSettings({ adsense_pub_id: "ca-pub-9920194819284102", ads_auto: "false" })),
    ).toBe("");
  });
  it("exposes exactly the six placements", () => {
    expect([...AD_SLOTS].sort()).toEqual(
      ["header", "below_search", "above_result", "midpage", "footer", "sticky"].sort(),
    );
  });
});
