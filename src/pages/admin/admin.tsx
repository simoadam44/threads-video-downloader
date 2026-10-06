import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { adminApi } from "../../lib/admin-api";

export function useNoIndex() {
  useEffect(() => {
    document.title = "Admin - Threads Video Downloader";
    let meta = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = "noindex, nofollow";
    return () => {
      meta.content = prev;
    };
  }, []);
}

export function AdminShell({ children }: { children: ReactNode }) {
  useNoIndex();
  const nav = useNavigate();
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <Link to="/admin">Overview</Link>
        <Link to="/admin/requests">Requests</Link>
        <Link to="/admin/keywords-tools">Keywords &amp; Tools</Link>
        <Link to="/admin/blog-guides">Blog &amp; Guides</Link>
        <Link to="/admin/seo-webmaster">SEO &amp; Webmaster</Link>
        <Link to="/admin/adsense-ads">AdSense &amp; Ads</Link>
        <Link to="/admin/settings">Settings</Link>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          style={{ padding: "6px 12px", fontSize: 14 }}
          onClick={async () => {
            await adminApi.logout().catch(() => {});
            nav("/admin/login");
          }}
        >
          Logout
        </button>
      </nav>
      {children}
    </section>
  );
}

export function AdminLogin() {
  useNoIndex();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="section" style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1>Admin login</h1>
      <form
        className="card"
        style={{ textAlign: "left" }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await adminApi.login(email, password);
            nav("/admin");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            type="text"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Password
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="status" role="alert">
            {error}
          </p>
        )}
        <button className="btn" style={{ marginTop: 16, width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

export function AdminOverview() {
  const [data, setData] = useState<null | Awaited<ReturnType<typeof adminApi.stats>>>(null);
  const [error, setError] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    adminApi
      .stats()
      .then(setData)
      .catch((err) => {
        if (String(err.message).includes("401")) nav("/admin/login");
        else setError(err instanceof Error ? err.message : "Failed to load stats.");
      });
  }, [nav]);
  return (
    <AdminShell>
      <h1>Overview</h1>
      {error && (
        <p className="status" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <>
          <div className="grid4">
            {[
              ["Total resolves", data.total],
              ["Successful", data.success],
              ["Errors", data.errors],
              ["Rate limited (24h view)", data.rateLimited],
            ].map(([label, v]) => (
              <div className="card" key={label as string}>
                <h3>{v}</h3>
                <p>{label}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Last 24h: {data.last24h} requests</h3>
            <h3 style={{ marginTop: 16 }}>Recent</h3>
            {data.recent.map((r) => (
              <p key={r.id} className="example">
                #{r.id} · {r.status} · {r.media_count} media · {new Date(r.created_at).toLocaleString()}
              </p>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}

export function AdminRequests() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminApi.requests>>>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    adminApi
      .requests(20, page * 20)
      .then(setRows)
      .catch((err) => {
        if (String(err.message).includes("401")) nav("/admin/login");
        else setError(err instanceof Error ? err.message : "Failed to load requests.");
      });
  }, [page, nav]);
  return (
    <AdminShell>
      <h1>Requests</h1>
      {error && (
        <p className="status" role="alert">
          {error}
        </p>
      )}
      <div className="card">
        {rows.map((r) => (
          <p key={r.id} className="example">
            #{r.id} · {r.status} · {r.media_count} media · {new Date(r.created_at).toLocaleString()}
          </p>
        ))}
        {rows.length === 0 && <p className="example">No requests yet.</p>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
          ← Prev
        </button>
        <button className="btn btn-ghost" disabled={rows.length < 20} onClick={() => setPage(page + 1)}>
          Next →
        </button>
      </div>
    </AdminShell>
  );
}

const SETTING_LABELS: Record<string, string> = {
  resolver_provider: "Resolver provider (opensource | mock | external-optional)",
  resolve_limit: "Resolve rate limit per minute (1-600)",
  ads_enabled: "Ads enabled (true | false)",
  analytics_enabled: "Analytics enabled (true | false)",
};

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    adminApi
      .settings()
      .then(setSettings)
      .catch((err) => {
        if (String(err.message).includes("401")) nav("/admin/login");
        else setError(err instanceof Error ? err.message : "Failed to load settings.");
      });
  }, [nav]);
  return (
    <AdminShell>
      <h1>Settings</h1>
      <p className="lead">Secrets (API keys) are managed via Cloudflare secrets, never here.</p>
      {error && (
        <p className="status" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="status">{saved}</p>}
      <div className="card">
        {Object.keys(SETTING_LABELS).map((key) => (
          <form
            key={key}
            style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setSaved("");
              try {
                await adminApi.updateSetting(key, settings[key] ?? "");
                setSaved(`Saved ${key}.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Save failed.");
              }
            }}
          >
            <label style={{ flex: "1 1 260px" }}>
              {SETTING_LABELS[key]}
              <input
                className="icon-btn"
                style={{ display: "block", width: "100%", marginTop: 4 }}
                value={settings[key] ?? ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            </label>
            <button className="btn" style={{ padding: "8px 16px", fontSize: 14 }}>
              Save
            </button>
          </form>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>Admin Authentication & Password</h2>
      <p className="lead">Change the admin password used on this device (local development only).</p>
      {pwErr && (
        <p className="status" role="alert">
          {pwErr}
        </p>
      )}
      {pwMsg && <p className="status">{pwMsg}</p>}
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setPwErr("");
          setPwMsg("");
          if (next !== confirm) {
            setPwErr("New passwords do not match.");
            return;
          }
          try {
            await adminApi.changePassword(cur, next);
            setPwMsg("Password changed. Use the new password next time you sign in.");
            setCur("");
            setNext("");
            setConfirm("");
          } catch (err) {
            setPwErr(err instanceof Error ? err.message : "Password change failed.");
          }
        }}
      >
        <label style={{ display: "block", marginBottom: 12 }}>
          Current password
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            type="password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          New password (min 8 characters)
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Confirm new password
          <input
            className="icon-btn"
            style={{ display: "block", width: "100%", marginTop: 4 }}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button className="btn">Change password</button>
      </form>
    </AdminShell>
  );
}
