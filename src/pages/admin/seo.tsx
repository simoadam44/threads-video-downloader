import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../../lib/admin-api";
import { AdminShell } from "./admin";

const KEYS = [
  { key: "ga4_id", label: "Google Analytics 4 Measurement ID (GA4)", hint: "Automatically injects the Google gtag.js asynchronous tracking engine on all pages.", placeholder: "G-XXXXXXXXXX" },
  { key: "gsc_code", label: "Google Search Console Verification Code / Meta Tag", hint: "Paste the verification code (plain text or full meta tag).", placeholder: "google-site-verification code" },
  { key: "bing_code", label: "Bing Webmaster Tools Verification Token", hint: "Paste the Bing verification token (plain text or full meta tag).", placeholder: '<meta name="msvalidate.01" content="…" />' },
  { key: "pixel_id", label: "Meta Pixel / Facebook Pixel ID", hint: "Numeric Pixel ID; injects fbevents.js + PageView tracking.", placeholder: "e.g. 192849182948192" },
  { key: "canonical_base", label: "Canonical Base Domain URL", hint: "Overrides canonical/OG URLs site-wide. Empty = current domain.", placeholder: "https://savethreadsvideos.com" },
  { key: "head_custom", label: "Custom <head> Code / Tracking Scripts", hint: "Injected before </head> on every server-rendered page.", textarea: true, placeholder: "<!-- custom meta or scripts -->" },
  { key: "body_custom", label: "Custom <body> Code / Chat Widgets", hint: "Injected before </body> on every server-rendered page.", textarea: true, placeholder: "<!-- chat widget -->" },
] as const;

export function SeoWebmaster() {
  const nav = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((s) => {
        setValues(s);
        setRobotsIndex((s["robots_index"] ?? "true") !== "false");
      })
      .catch((err) => {
        if (String(err).includes("401")) nav("/admin/login");
        else setError(err instanceof Error ? err.message : "Failed to load settings.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const payload: Record<string, string> = { ...values, robots_index: robotsIndex ? "true" : "false" };
      for (const { key } of KEYS) {
        await adminApi.updateSetting(key, payload[key] ?? "");
      }
      await adminApi.updateSetting("robots_index", payload["robots_index"]);
      setSaved("✓ Saved & injected — live on all server-rendered pages (cached ≤60s).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <form onSubmit={save}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>📈 SEO Tracking, Google Analytics &amp; Webmaster Verification</h1>
            <p className="lead">Connect Google Analytics 4, Search Console, Bing Webmaster, Facebook Pixel, and inject custom tracking scripts.</p>
          </div>
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : "✓ Save & Inject Tracking"}
          </button>
        </div>
        {error && <p className="status" role="alert">{error}</p>}
        {saved && <p className="status">{saved}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 8 }}>
          <div className="card">
            <h2>🌐 GOOGLE WEBMASTER &amp; ANALYTICS</h2>
            {KEYS.slice(0, 4).map(({ key, label, hint, placeholder }) => (
              <label key={key} style={{ display: "block", marginBottom: 14 }}>
                <strong>{label}</strong>
                <input
                  className="icon-btn"
                  style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "monospace", fontSize: 13 }}
                  value={values[key] ?? ""}
                  placeholder={placeholder}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
                <span className="example" style={{ display: "block" }}>{hint}</span>
              </label>
            ))}
          </div>
          <div className="card">
            <h2>🧩 CUSTOM SCRIPTS &amp; INDEXING CONTROL</h2>
            <label className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span>
                <strong>Search Engine Robots Indexing</strong>
                <span className="example" style={{ display: "block" }}>
                  Emit <span style={{ color: "#f87171" }}>index, follow</span> in robots meta tag
                </span>
              </span>
              <input
                type="checkbox"
                checked={robotsIndex}
                onChange={(e) => setRobotsIndex(e.target.checked)}
                aria-label="Allow search engine indexing"
                style={{ width: 22, height: 22, accentColor: "#f43f5e" }}
              />
            </label>
            {KEYS.slice(4).map(({ key, label, hint, placeholder, ...rest }) => (
              <label key={key} style={{ display: "block", marginBottom: 14 }}>
                <strong>{label}</strong>
                {"textarea" in rest ? (
                  <textarea
                    className="icon-btn"
                    style={{ display: "block", width: "100%", minHeight: 110, fontFamily: "monospace", fontSize: 12 }}
                    value={values[key] ?? ""}
                    placeholder={placeholder}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="icon-btn"
                    style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "monospace", fontSize: 13 }}
                    value={values[key] ?? ""}
                    placeholder={placeholder}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  />
                )}
                <span className="example" style={{ display: "block" }}>{hint}</span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
