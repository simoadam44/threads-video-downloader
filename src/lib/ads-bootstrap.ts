/**
 * Client-side AdSense bootstrap for the SPA shell: loads auto-ads once when
 * enabled. Slot-level <ins> units are rendered by the AdSlot component.
 */

let started = false;

export async function bootstrapAds(): Promise<void> {
  if (started) return;
  started = true;
  let cfg: { pubId?: string; autoAds?: boolean };
  try {
    const res = await fetch("/api/ads.json");
    if (!res.ok) return;
    cfg = (await res.json()) as { pubId?: string; autoAds?: boolean };
  } catch {
    return;
  }
  if (!cfg.pubId || !cfg.autoAds) return;
  if ([...document.querySelectorAll("script[src]")].some((s) => (s.getAttribute("src") || "").includes("pagead2.googlesyndication.com"))) return;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.pubId}`;
  document.head.appendChild(s);
}
