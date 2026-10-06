import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, type AdminToolPage, type AdminGuide, type ContentFaq } from "../../lib/admin-api";
import { AdminShell } from "./admin";

type ToolForm = Omit<AdminToolPage, "id">;
type GuideForm = Omit<AdminGuide, "id">;

const EMPTY_TOOL: ToolForm = {
  slug: "", badge: "", lang: "en", target_keyword: "", title: "",
  description: "", h1: "", intro: "", faqs: [], related_slugs: [], status: "draft",
};

const EMPTY_GUIDE: GuideForm = {
  slug: "", lang: "en", target_keyword: "", title: "",
  description: "", h1: "", body: "", faqs: [], related_slugs: [], status: "draft",
};

function FaqEditor({ faqs, onChange }: { faqs: ContentFaq[]; onChange: (f: ContentFaq[]) => void }) {
  return (
    <div>
      <strong>FAQs (min 3, answers ≥30 chars)</strong>
      {faqs.map((f, i) => (
        <div key={i} className="card" style={{ marginTop: 8, padding: 12 }}>
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginBottom: 6 }}
            placeholder={`Question ${i + 1} (min 10 chars)`}
            value={f.q}
            onChange={(e) => {
              const next = [...faqs];
              next[i] = { ...next[i], q: e.target.value };
              onChange(next);
            }}
          />
          <textarea
            className="icon-btn"
            style={{ display: "block", width: "100%", minHeight: 60 }}
            placeholder="Answer (min 30 chars)"
            value={f.a}
            onChange={(e) => {
              const next = [...faqs];
              next[i] = { ...next[i], a: e.target.value };
              onChange(next);
            }}
          />
          <button type="button" className="btn btn-ghost" style={{ marginTop: 6, padding: "4px 10px", fontSize: 13 }} onClick={() => onChange(faqs.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onChange([...faqs, { q: "", a: "" }])}>
        + Add FAQ
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <strong>{label}</strong>
      {hint && <span className="example" style={{ display: "block" }}>{hint}</span>}
      <span style={{ display: "block", marginTop: 4 }}>{children}</span>
    </label>
  );
}

function textInput(value: string, onChange: (v: string) => void, placeholder = "") {
  return (
    <input className="icon-btn" style={{ width: "100%" }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

function ToolFormFields({ form, setForm }: { form: ToolForm; setForm: (f: ToolForm) => void }) {
  const set = (k: keyof ToolForm) => (v: string) => setForm({ ...form, [k]: v });
  return (
    <>
      <Field label="Slug" hint="lowercase letters/digits/hyphens, max 120">{textInput(form.slug, set("slug"), "threads-video-downloader-hd")}</Field>
      <Field label="Badge" hint="short label, max 40 chars">{textInput(form.badge, set("badge"), "HD VIDEO")}</Field>
      <Field label="Language">
        <select className="icon-btn" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </Field>
      <Field label="Target keyword">{textInput(form.target_keyword, set("target_keyword"), "Threads Video Downloader")}</Field>
      <Field label="Title" hint="30-160 chars, unique">{textInput(form.title, set("title"))}</Field>
      <Field label="Meta description" hint="120-320 chars, unique">{textInput(form.description, set("description"))}</Field>
      <Field label="H1" hint="10-140 chars">{textInput(form.h1, set("h1"))}</Field>
      <Field label="Intro" hint="min 100 chars — no thin pages">
        <textarea className="icon-btn" style={{ width: "100%", minHeight: 80 }} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
      </Field>
      <FaqEditor faqs={form.faqs} onChange={(faqs) => setForm({ ...form, faqs })} />
      <Field label="Related slugs" hint="comma-separated (existing tool/guide slugs)">
        {textInput(form.related_slugs.join(", "), (v) => setForm({ ...form, related_slugs: v.split(",").map((s) => s.trim()).filter(Boolean) }))}
      </Field>
      <Field label="Status">
        <select className="icon-btn" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
        </select>
      </Field>
    </>
  );
}

function GuideFormFields({ form, setForm }: { form: GuideForm; setForm: (f: GuideForm) => void }) {
  const set = (k: keyof GuideForm) => (v: string) => setForm({ ...form, [k]: v });
  return (
    <>
      <Field label="Slug" hint="under /blog/, max 120">{textInput(form.slug, set("slug"), "how-to-download-threads-videos-on-iphone")}</Field>
      <Field label="Language">
        <select className="icon-btn" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </Field>
      <Field label="Target keyword">{textInput(form.target_keyword, set("target_keyword"))}</Field>
      <Field label="Title" hint="30-160 chars, unique">{textInput(form.title, set("title"))}</Field>
      <Field label="Meta description" hint="120-320 chars, unique">{textInput(form.description, set("description"))}</Field>
      <Field label="H1" hint="10-140 chars">{textInput(form.h1, set("h1"))}</Field>
      <Field label="Body (HTML, min 800 chars)" hint="allowed: p h2-h4 ul ol li strong em a img blockquote code pre">
        <textarea className="icon-btn" style={{ width: "100%", minHeight: 200, fontFamily: "monospace", fontSize: 13 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </Field>
      <FaqEditor faqs={form.faqs} onChange={(faqs) => setForm({ ...form, faqs })} />
      <Field label="Related slugs" hint="comma-separated">
        {textInput(form.related_slugs.join(", "), (v) => setForm({ ...form, related_slugs: v.split(",").map((s) => s.trim()).filter(Boolean) }))}
      </Field>
      <Field label="Status">
        <select className="icon-btn" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
        </select>
      </Field>
    </>
  );
}

function statusPill(status: string) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: status === "live" ? "#14532d" : "#3f3f46",
        color: status === "live" ? "#4ade80" : "#d4d4d8",
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

export function KeywordsTools() {
  const nav = useNavigate();
  const [rows, setRows] = useState<AdminToolPage[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminToolPage | null | "new">(null);
  const [form, setForm] = useState<ToolForm>(EMPTY_TOOL);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await adminApi.toolPages());
    } catch (err) {
      if (String(err).includes("401")) nav("/admin/login");
      else setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setForm(EMPTY_TOOL);
    setEditing("new");
  }
  function openEdit(row: AdminToolPage) {
    const { id: _id, ...rest } = row;
    void _id;
    setForm(rest);
    setEditing(row);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing === "new") await adminApi.createToolPage(form);
      else if (editing) await adminApi.updateToolPage(editing.id, form);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(row: AdminToolPage) {
    if (!confirm(`Delete /${row.slug}?`)) return;
    try {
      await adminApi.deleteToolPage(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>🔍 Keywords &amp; Tools Engine</h1>
          <p className="lead">High-intent keyword landing pages. Each page renders the downloader with unique SEO title, H1 and FAQs.</p>
        </div>
        <button className="btn" onClick={openNew}>+ Add Tool Page</button>
      </div>
      {error && <p className="status" role="alert">{error}</p>}
      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={{ padding: 12 }}>BADGE</th>
              <th style={{ padding: 12 }}>SLUG</th>
              <th style={{ padding: 12 }}>TARGET KEYWORD</th>
              <th style={{ padding: 12 }}>TITLE</th>
              <th style={{ padding: 12 }}>STATUS</th>
              <th style={{ padding: 12 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: 12 }}><strong>{r.badge || "—"}</strong></td>
                <td style={{ padding: 12 }}><code>/{r.slug}</code></td>
                <td style={{ padding: 12 }}>{r.target_keyword}</td>
                <td style={{ padding: 12 }}>{r.title.slice(0, 48)}{r.title.length > 48 ? "…" : ""}</td>
                <td style={{ padding: 12 }}>{statusPill(r.status)}</td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  <a className="icon-btn" style={{ textDecoration: "none", marginRight: 6 }} href={`/${r.slug}`} target="_blank" rel="noreferrer" title="Preview">↗</a>
                  <button className="icon-btn" style={{ marginRight: 6 }} onClick={() => openEdit(r)} title="Edit">✎</button>
                  <button className="icon-btn" onClick={() => void remove(r)} title="Delete">🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 16 }} className="example">No tool pages yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{editing === "new" ? "Add Tool Page" : `Edit /${editing.slug}`}</h2>
          <form onSubmit={save}>
            <ToolFormFields form={form} setForm={setForm} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

export function BlogGuides() {
  const nav = useNavigate();
  const [rows, setRows] = useState<AdminGuide[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminGuide | null | "new">(null);
  const [form, setForm] = useState<GuideForm>(EMPTY_GUIDE);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await adminApi.guides());
    } catch (err) {
      if (String(err).includes("401")) nav("/admin/login");
      else setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setForm(EMPTY_GUIDE);
    setEditing("new");
  }
  function openEdit(row: AdminGuide) {
    const { id: _id, ...rest } = row;
    void _id;
    setForm(rest);
    setEditing(row);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing === "new") await adminApi.createGuide(form);
      else if (editing) await adminApi.updateGuide(editing.id, form);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(row: AdminGuide) {
    if (!confirm(`Delete /blog/${row.slug}?`)) return;
    try {
      await adminApi.deleteGuide(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>📖 Blog &amp; Guides Engine</h1>
          <p className="lead">Long-tail question articles under /blog/slug with Article + FAQPage schemas.</p>
        </div>
        <button className="btn" onClick={openNew}>+ Add Guide</button>
      </div>
      {error && <p className="status" role="alert">{error}</p>}
      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={{ padding: 12 }}>TARGET KEYWORD</th>
              <th style={{ padding: 12 }}>SLUG</th>
              <th style={{ padding: 12 }}>TITLE</th>
              <th style={{ padding: 12 }}>STATUS</th>
              <th style={{ padding: 12 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: 12 }}>{r.target_keyword}</td>
                <td style={{ padding: 12 }}><code>/blog/{r.slug}</code></td>
                <td style={{ padding: 12 }}>{r.title.slice(0, 48)}{r.title.length > 48 ? "…" : ""}</td>
                <td style={{ padding: 12 }}>{statusPill(r.status)}</td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  <a className="icon-btn" style={{ textDecoration: "none", marginRight: 6 }} href={`/blog/${r.slug}`} target="_blank" rel="noreferrer" title="Preview">↗</a>
                  <button className="icon-btn" style={{ marginRight: 6 }} onClick={() => openEdit(r)} title="Edit">✎</button>
                  <button className="icon-btn" onClick={() => void remove(r)} title="Delete">🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 16 }} className="example">No guides yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{editing === "new" ? "Add Guide" : `Edit /blog/${editing.slug}`}</h2>
          <form onSubmit={save}>
            <GuideFormFields form={form} setForm={setForm} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
