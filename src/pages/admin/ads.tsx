import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../../lib/admin-api";
import { AdminShell } from "./admin";
import type { AdSlotName } from "../../server/content/ads";

const SLOTS: { key: AdSlotName; label: string; desc: string }[] = [
  { key: "header", label: "Header Leaderboard Banner", desc: "Top of page (728x90 desktop / 320x50 mobile)" },
  { key: "below_search", label: "Below Downloader Search Bar", desc: "High viewability responsive in-feed native slot" },
  { key: "above_result", label: "Above Media Result Card", desc: "High click-through placement shown when download is ready" },
  { key: "midpage", label: "In-Content Banner (Mid-Page)", desc: "Between How-To steps and Features grid" },
  { key: "footer", label: "Footer Banner", desc: "Bottom of the page above footer links" },
  { key: "sticky", label: "Sticky Bottom Floating Dock", desc: "Fixed mobile & desktop bottom banner with close button" },
];

export function AdsenseAds() {
  const nav = useNavigate();
  const [pubId, setPubId] = useState("");
  const [autoAds, setAutoAds] = useState(false);
  const [slots, setSlots] = useState<Record<AdSlotName, boolean>>({
    header: false,
    below_search: false,
    above_result: false,
    midpage: false,
    footer: false,
    sticky: false,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((s) => {
        setPubId(s["adsense_pub_id"] ?? "");
        setAutoAds((s["ads_auto"] ?? "false") === "true");
        setSlots({
          header: (s["ad_slot_header"] ?? "false") === "true",
          below_search: (s["ad_slot_below_search"] ?? "false") === "true",
          above_result: (s["ad_slot_above_result"] ?? "false") === "true",
          midpage: (s["ad_slot_midpage"] ?? "false") === "true",
          footer: (s["ad_slot_footer"] ?? "false") === "true",
          sticky: (s["ad_slot_sticky"] ?? "false") === "true",
        });
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
      await adminApi.updateSetting("adsense_pub_id", pubId.trim());
      await adminApi.updateSetting("ads_auto", autoAds ? "true" : "false");
      for (const { key } of SLOTS) {
        await adminApi.updateSetting(`ad_slot_${key}`, slots[key] ? "true" : "false");
      }
      setSaved("✓ Saved & applied — placements update live without rebuild.");
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
            <h1>💲 Google AdSense &amp; Multi-Network Ad Spaces</h1>
            <p className="lead">Configure Google AdSense Auto-Ads, native responsive banner slots, in-content ads, sticky footer bar, or custom ad network scripts.</p>
          </div>
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : "✓ Save & Apply Ad Placements"}
          </button>
        </div>
        {error && <p className="status" role="alert">{error}</p>}
        {saved && <p className="status">{saved}</p>}
        <div className="card" style={{ marginTop: 8 }}>
          <h2>⚡ Google AdSense Global Publisher ID</h2>
          <p className="example">Enter your Google AdSense Publisher ID (ca-pub-XXXXXXXXXXXXXXXX) to activate ads across your site.</p>
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", fontFamily: "monospace", fontSize: 13 }}
            value={pubId}
            placeholder="ca-pub-XXXXXXXXXXXXXXXX"
            onChange={(e) => setPubId(e.target.value)}
          />
          <label style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12 }}>
            <strong>Enable Auto Ads</strong>
            <input
              type="checkbox"
              checked={autoAds}
              onChange={(e) => setAutoAds(e.target.checked)}
              aria-label="Enable Auto Ads"
              style={{ width: 22, height: 22, accentColor: "#111" }}
            />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
          {SLOTS.map(({ key, label, desc }) => (
            <div className="card" key={key}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span>
                  <strong>{label}</strong>
                  <span className="example" style={{ display: "block" }}>{desc}</span>
                </span>
                <input
                  type="checkbox"
                  checked={slots[key]}
                  onChange={(e) => setSlots({ ...slots, [key]: e.target.checked })}
                  aria-label={label}
                  style={{ width: 22, height: 22, accentColor: "#111", flexShrink: 0 }}
                />
              </label>
            </div>
          ))}
        </div>
      </form>
    </AdminShell>
  );
}
