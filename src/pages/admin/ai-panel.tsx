import { useState } from "react";
import { adminApi, type AiDraft } from "../../lib/admin-api";
import { GEMINI_MODELS, DEFAULT_AI_MODEL } from "../../lib/ai-models";
import { sanitizeApiKey } from "../../lib/keys";

/**
 * Collapsible AI generator settings (free Gemini tier). The API key is
 * write-only: the server masks it and never returns it to the browser.
 */
export function AiSettingsCard() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyHint, setKeyHint] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_AI_MODEL);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (loaded) return;
    try {
      const s = await adminApi.settings();
      setKeyHint(String(s["gemini_key_hint"] || ""));
      setModel(String(s["gemini_model"] || DEFAULT_AI_MODEL));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI settings.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      // Strip pasted whitespace/invisible chars (RTL UIs inject them) before saving.
      const nextKey = sanitizeApiKey(keyInput);
      if (nextKey) {
        try {
          await adminApi.updateSetting("gemini_api_key", nextKey);
        } catch {
          throw new Error("The API key was rejected: copy it whole from AI Studio (it starts with “AIza” or “AQ.”, no extra spaces).");
        }
        setKeyHint(`${nextKey.slice(0, 4)}…${nextKey.slice(-4)}`);
        setKeyInput("");
      }
      try {
        await adminApi.updateSetting("gemini_model", model);
      } catch {
        throw new Error("The selected model was rejected. Pick another model from the list.");
      }
      setStatus("✓ Saved — the AI generator uses this key and model for new drafts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await adminApi.updateSetting("gemini_api_key", "");
      setKeyHint("");
      setKeyInput("");
      setStatus("✓ API key removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ width: "100%", justifyContent: "space-between", display: "flex" }}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
        aria-expanded={open}
      >
        <span>✨ AI Content Generator (Gemini — free tier)</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={save} style={{ marginTop: 12 }}>
          <p className="example" style={{ marginBottom: 12 }}>
            Google AI Studio free tier: no credit card, ~1,500 requests/day per model. Get a key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
            . The key is stored server-side only and never returned to this page.
          </p>
          <label style={{ display: "block", marginBottom: 12 }}>
            <strong>Gemini API key</strong>
            <input
              className="icon-btn"
              type="password"
              autoComplete="off"
              style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "monospace", fontSize: 13 }}
              value={keyInput}
              placeholder={keyHint ? "Type a new key to replace the configured one" : "AIza… or AQ.…"}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <span className="example" style={{ display: "block" }}>
              {keyHint ? `Configured (${keyHint}). Leave empty to keep the current key. ` : "Not configured yet. "}
              Generate drafts directly from this page with the button in the form.
            </span>
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <strong>Model</strong>
            <select className="icon-btn" style={{ display: "block", width: "100%", marginTop: 4 }} value={model} onChange={(e) => setModel(e.target.value)}>
              {GEMINI_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="example" style={{ display: "block" }}>
              Switch if a model is unavailable in your region or quota is exhausted (another model has its own free quota).
            </span>
          </label>
          {error && <p className="status" role="alert">{error}</p>}
          {status && <p className="status">{status}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save AI settings"}</button>
            {keyHint && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void removeKey()}>
                Remove key
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * "Generate with AI" button: fills the parent form with a unique draft from
 * the target keyword. Drafts are always saved manually by the admin.
 */
export function AiDraftButton({
  kind,
  keyword,
  lang,
  onDraft,
}: {
  kind: "tool" | "guide";
  keyword: string;
  lang: string;
  onDraft: (draft: AiDraft) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const ready = keyword.trim().length >= 3;

  async function generate() {
    setBusy(true);
    setError("");
    setNotes([]);
    try {
      const res = await adminApi.generateDraft({ kind, target_keyword: keyword.trim(), lang });
      onDraft(res.draft);
      setNotes(res.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="btn"
        style={{ width: "100%", background: "linear-gradient(90deg,#8b5cf6,#6366f1)" }}
        disabled={busy || !ready}
        onClick={() => void generate()}
        title={ready ? "Generate a unique draft from the target keyword" : "Enter a target keyword first (3+ chars)"}
      >
        {busy ? "✨ Generating unique draft… (30–60s)" : "✨ Generate with AI from Target Keyword"}
      </button>
      {!ready && <span className="example" style={{ display: "block", marginTop: 4 }}>Enter a target keyword above to enable AI generation.</span>}
      {busy && <span className="example" style={{ display: "block", marginTop: 4 }}>Writing unique content that differs from your existing pages…</span>}
      {error && (
        <p className="status" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      {notes.length > 0 && !error && (
        <div className="card" style={{ marginTop: 8, padding: 12, borderColor: "#4ade80" }}>
          <strong style={{ color: "#4ade80" }}>✓ Draft inserted</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {notes.map((n, i) => (
              <li key={i} className="example">
                {n}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} disabled={busy} onClick={() => void generate()}>
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
