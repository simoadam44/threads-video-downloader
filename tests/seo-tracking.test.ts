import { describe, it, expect } from "vitest";
import {
  validateTrackingSetting,
  trackingFromSettings,
  trackingHeadHtml,
  trackingBodyHtml,
  robotsMetaContent,
  canonicalWithBase,
} from "../src/server/content/tracking";
import { renderStaticRoute } from "../src/server/content/render";
import { validateSetting } from "../src/server/db/types";

describe("tracking setting validation", () => {
  it("accepts valid IDs and empty (disabled)", () => {
    expect(validateTrackingSetting("ga4_id", "G-ABCDEF1234")).toBe(null);
    expect(validateTrackingSetting("ga4_id", "")).toBe(null);
    expect(validateTrackingSetting("pixel_id", "192849182948192")).toBe(null);
    expect(validateTrackingSetting("robots_index", "true")).toBe(null);
    expect(validateTrackingSetting("canonical_base", "https://savethreadsvideos.com")).toBe(null);
    expect(validateTrackingSetting("head_custom", "<!-- ok -->")).toBe(null);
  });
  it("rejects malformed values", () => {
    expect(validateTrackingSetting("ga4_id", "UA-123")).not.toBe(null);
    expect(validateTrackingSetting("pixel_id", "abc")).not.toBe(null);
    expect(validateTrackingSetting("robots_index", "maybe")).not.toBe(null);
    expect(validateTrackingSetting("canonical_base", "http://insecure.com")).not.toBe(null);
    expect(validateTrackingSetting("canonical_base", "not a url")).not.toBe(null);
    expect(validateTrackingSetting("head_custom", '<script src="http://evil.com/x.js"></script>')).not.toBe(null);
    expect(validateTrackingSetting("head_custom", "x".repeat(20_001))).not.toBe(null);
    expect(validateTrackingSetting("gsc_code", '<script>alert(1)</script>')).not.toBe(null);
  });
  it("wires into the generic settings allowlist", () => {
    expect(validateSetting("ga4_id", "G-ABCDEF1234")).toBe(true);
    expect(validateSetting("ga4_id", "UA-123")).toBe(false);
    expect(validateSetting("pixel_id", "abc")).toBe(false);
    expect(validateSetting("head_custom", "x".repeat(20_001))).toBe(false);
    expect(validateSetting("head_custom", "<!-- custom -->")).toBe(true);
  });
});

describe("tracking injection", () => {
  const t = trackingFromSettings({
    ga4_id: "G-TEST123456",
    gsc_code: "google-code",
    bing_code: '<meta name="msvalidate.01" content="bing-code" />',
    pixel_id: "123456789012345",
    robots_index: "true",
    canonical_base: "https://savethreadsvideos.com",
    head_custom: "<!-- head -->",
    body_custom: "<!-- body -->",
  });
  it("emits verification metas + vendor scripts, escaped", () => {
    const head = trackingHeadHtml(t);
    expect(head).toContain("gtag/js?id=G-TEST123456");
    expect(head).toContain('name="google-site-verification" content="google-code"');
    expect(head).toContain('name="msvalidate.01" content="bing-code"');
    expect(head).toContain("fbevents.js");
    expect(head).toContain("<!-- head -->");
  });
  it("emits pixel noscript + body custom", () => {
    const body = trackingBodyHtml(t);
    expect(body).toContain("facebook.com/tr?id=123456789012345");
    expect(body).toContain("<!-- body -->");
  });
  it("emits nothing when unconfigured", () => {
    const empty = trackingFromSettings({});
    expect(trackingHeadHtml(empty)).toBe("");
    expect(trackingBodyHtml(empty)).toBe("");
    expect(robotsMetaContent(empty)).toBe("index, follow, max-image-preview:large");
  });
  it("robots toggle + canonical override", () => {
    expect(robotsMetaContent(trackingFromSettings({ robots_index: "false" }))).toBe("noindex, nofollow");
    expect(canonicalWithBase("https://old.example/x/", t)).toBe("https://savethreadsvideos.com/x");
    expect(canonicalWithBase("https://old.example/", t)).toBe("https://savethreadsvideos.com/");
  });
});

describe("static SSR", () => {
  const route = { path: "/faq", title: "FAQ Title Here", description: "A fine description.", h1: "FAQ H1" };
  it("renders route meta without template or tracking", () => {
    const html = renderStaticRoute(null, "https://savethreadsvideos.com", "/og-image.png", route);
    expect(html).toContain("<title>FAQ Title Here</title>");
    expect(html).toContain("<h1>FAQ H1</h1>");
    expect(html).toContain('rel="canonical" href="https://savethreadsvideos.com/faq"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).not.toContain("gtag");
  });
  it("injects tracking + robots + canonical override when configured", () => {
    const t = trackingFromSettings({
      ga4_id: "G-TEST123456", robots_index: "false",
      canonical_base: "https://savethreadsvideos.com", head_custom: "<!-- h -->", body_custom: "<!-- b -->",
    });
    const html = renderStaticRoute(null, "https://old.example", "/og-image.png", route, t);
    expect(html).toContain("gtag/js?id=G-TEST123456");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('rel="canonical" href="https://savethreadsvideos.com/faq"');
    expect(html).toContain("<!-- h -->");
    expect(html).toContain("<!-- b -->");
  });
});
