/**
 * Client-side tracking bootstrap for the SPA shell (notably `/`, which is
 * served as a static file and bypasses Worker head injection).
 * Server-rendered pages already carry these tags — every step checks for
 * existing tags first so nothing loads twice.
 */

interface TrackingJson {
  ga4_id?: string;
  pixel_id?: string;
  gsc_code?: string;
  bing_code?: string;
  robots_index?: boolean;
  canonical_base?: string;
  head_custom?: string;
  body_custom?: string;
}

function hasScriptSrc(part: string): boolean {
  return [...document.querySelectorAll("script[src]")].some((s) =>
    (s.getAttribute("src") || "").includes(part),
  );
}

function addMeta(name: string, content: string): void {
  if (document.head.querySelector(`meta[name="${name}"]`)) return;
  const m = document.createElement("meta");
  m.name = name;
  m.content = content;
  document.head.appendChild(m);
}

/** Insert HTML so that <script> blocks actually execute (innerHTML alone won't run them). */
function injectHtml(target: ParentNode, html: string): void {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const node of [...tpl.content.childNodes]) {
    if (node.nodeName === "SCRIPT") {
      const el = node as Element;
      const s = document.createElement("script");
      for (const a of el.attributes) {
        if (/^on/i.test(a.name)) continue;
        s.setAttribute(a.name, a.value);
      }
      s.textContent = el.textContent;
      target.appendChild(s);
    } else {
      target.appendChild(node.cloneNode(true));
    }
  }
}

function addScript(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function addInline(code: string): void {
  const s = document.createElement("script");
  s.textContent = code;
  document.head.appendChild(s);
}

export async function bootstrapTracking(): Promise<void> {
  let t: TrackingJson;
  try {
    const res = await fetch("/api/tracking.json");
    if (!res.ok) return;
    t = (await res.json()) as TrackingJson;
  } catch {
    return;
  }
  if (t.ga4_id && !hasScriptSrc("googletagmanager.com")) {
    addScript(`https://www.googletagmanager.com/gtag/js?id=${t.ga4_id}`);
    addInline(
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.ga4_id.replace(/'/g, "")}');`,
    );
  }
  if (t.pixel_id && !hasScriptSrc("fbevents.js")) {
    addInline(
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src='https://connect.facebook.net/en_US/fbevents.js';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script');fbq('init','${t.pixel_id.replace(/'/g, "")}');fbq('track','PageView');`,
    );
  }
  if (t.gsc_code) addMeta("google-site-verification", t.gsc_code);
  if (t.bing_code) {
    const m = t.bing_code.match(/content=["']([^"']+)["']/i);
    addMeta("msvalidate.01", m ? m[1] : t.bing_code);
  }
  if (t.robots_index === false && !document.head.querySelector('meta[name="robots"]')) {
    addMeta("robots", "noindex, nofollow");
  }
  if (t.head_custom && !document.head.querySelector("[data-tracking-custom]")) {
    const marker = document.createElement("meta");
    marker.setAttribute("data-tracking-custom", "head");
    document.head.appendChild(marker);
    injectHtml(document.head, t.head_custom);
  }
  if (t.body_custom && !document.body.querySelector("[data-tracking-custom]")) {
    const marker = document.createElement("span");
    marker.setAttribute("data-tracking-custom", "body");
    marker.style.display = "none";
    document.body.appendChild(marker);
    injectHtml(document.body, t.body_custom);
  }
}
