/**
 * Tracking & Webmaster engine: GA4, Search Console, Bing, Meta Pixel,
 * robots/canonical control and custom head/body injection.
 * Settings live in app_settings (DB) so changes apply without rebuild.
 * All values are validated on write; rendering escapes everything except
 * the admin-authored custom code blocks (trusted admin source only).
 */

export interface TrackingConfig {
  ga4_id: string;
  gsc_code: string;
  bing_code: string;
  pixel_id: string;
  robots_index: boolean;
  canonical_base: string;
  head_custom: string;
  body_custom: string;
}

const MAX_CUSTOM_BYTES = 20_000;

export function validateTrackingSetting(key: string, value: string): string | null {
  switch (key) {
    case "ga4_id":
      if (value !== "" && !/^G-[A-Z0-9]{4,20}$/.test(value)) return "GA4 ID must look like G-XXXXXXXX.";
      break;
    case "gsc_code":
      if (value.length > 256) return "Search Console code too long.";
      if (/[<>"']/.test(value)) return "Search Console code must be plain text.";
      break;
    case "bing_code":
      if (value.length > 512) return "Bing token too long.";
      if (/[<>"']/.test(value)) return "Bing token must be plain text.";
      break;
    case "pixel_id":
      if (value !== "" && !/^\d{5,20}$/.test(value)) return "Pixel ID must be 5-20 digits.";
      break;
    case "robots_index":
      if (value !== "true" && value !== "false") return "robots_index must be true or false.";
      break;
    case "canonical_base":
      if (value !== "") {
        try {
          const u = new URL(value);
          if (u.protocol !== "https:") return "Canonical base must be an https URL.";
        } catch {
          return "Canonical base must be a valid URL.";
        }
      }
      break;
    case "head_custom":
    case "body_custom":
      if (value.length > MAX_CUSTOM_BYTES) return "Custom code exceeds 20KB.";
      if (/<\s*(script[^>]*src\s*=\s*["']?(?!https:\/\/)[^>]*>)/i.test(value)) {
        return "External scripts must use https URLs.";
      }
      break;
    default:
      return "Unknown tracking key.";
  }
  return null;
}

export function trackingFromSettings(s: Record<string, string>): TrackingConfig {
  return {
    ga4_id: (s["ga4_id"] || "").trim(),
    gsc_code: (s["gsc_code"] || "").trim(),
    bing_code: (s["bing_code"] || "").trim(),
    pixel_id: (s["pixel_id"] || "").trim(),
    robots_index: (s["robots_index"] ?? "true") !== "false",
    canonical_base: (s["canonical_base"] || "").trim().replace(/\/$/, ""),
    head_custom: s["head_custom"] || "",
    body_custom: s["body_custom"] || "",
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Head injections: verification metas + GA4 + Pixel. Custom code appended by caller. */
export function trackingHeadHtml(t: TrackingConfig): string {
  const parts: string[] = [];
  if (t.gsc_code) parts.push(`<meta name="google-site-verification" content="${esc(t.gsc_code)}" />`);
  if (t.bing_code) {
    const m = t.bing_code.match(/content=["']([^"']+)["']/i);
    parts.push(
      m
        ? `<meta name="msvalidate.01" content="${esc(m[1])}" />`
        : `<meta name="msvalidate.01" content="${esc(t.bing_code)}" />`,
    );
  }
  if (t.ga4_id) {
    parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(t.ga4_id)}"></script>`);
    parts.push(
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(t.ga4_id)}');</script>`,
    );
  }
  if (t.pixel_id) {
    parts.push(
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src='https://connect.facebook.net/en_US/fbevents.js';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script');fbq('init','${esc(t.pixel_id)}');fbq('track','PageView');</script>`,
    );
  }
  if (t.head_custom) parts.push(t.head_custom);
  return parts.join("\n");
}

export function trackingBodyHtml(t: TrackingConfig): string {
  const parts: string[] = [];
  if (t.pixel_id) {
    parts.push(
      `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${esc(t.pixel_id)}&ev=PageView&noscript=1" alt="" /></noscript>`,
    );
  }
  if (t.body_custom) parts.push(t.body_custom);
  return parts.join("\n");
}

export function robotsMetaContent(t: TrackingConfig): string {
  return t.robots_index ? "index, follow, max-image-preview:large" : "noindex, nofollow";
}

export function canonicalWithBase(canonical: string, t: TrackingConfig): string {
  if (!t.canonical_base) return canonical;
  try {
    const path = new URL(canonical).pathname.replace(/\/$/, "") || "/";
    return t.canonical_base + (path === "/" ? "/" : path);
  } catch {
    return canonical;
  }
}
