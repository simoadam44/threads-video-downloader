import { useEffect, useRef, useState } from "react";
import type { ApiErrorCode, MediaItem, ResolvedPost } from "../types";
import { resolveUrl } from "../lib/api";
import { mediaFilename, extensionFromMime } from "../lib/filenames";
import { extractMp3, mp3Filename, type Mp3Stage } from "../lib/mp3";
import { useI18n } from "../i18n";
import { Link } from "react-router-dom";
import { AdSlot } from "./chrome";

function extractClientSide(input: string): string {
  const m = input.match(/https?:\/\/[^\s"'<>`]+threads\.(net|com)[^\s"'<>`]*/i);
  return (m ? m[0] : input).trim();
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; post: ResolvedPost }
  | { kind: "error"; code: ApiErrorCode };

const FALLBACK_MSG: Record<ApiErrorCode, string> = {
  INVALID_URL: "Please enter a valid public Threads URL.",
  UNSUPPORTED_URL: "This link is not a supported public Threads post URL.",
  NOT_FOUND: "We could not find this post. It may have been deleted.",
  PRIVATE_CONTENT: "This post appears to be private. Only public posts are supported.",
  MEDIA_NOT_FOUND: "No downloadable media was found in this post.",
  RESOLVER_UNAVAILABLE: "Something went wrong while retrieving this media. Please try again.",
  RATE_LIMITED: "Too many requests. Please wait a minute and try again.",
  TEMPORARY_ERROR: "Something went wrong while retrieving this media. Please try again.",
  DOWNLOAD_FAILED: "The download failed. Please try again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
};

export function DownloadForm() {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const url = extractClientSide(value);
    if (!url) {
      setStatus({ kind: "error", code: "INVALID_URL" });
      return;
    }
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus({ kind: "loading" });
    try {
      const res = await resolveUrl(url, abort.current.signal);
      if (res.success) setStatus({ kind: "done", post: res.data });
      else setStatus({ kind: "error", code: res.error.code });
    } catch {
      setStatus({ kind: "error", code: "TEMPORARY_ERROR" });
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <form className="urlbar" onSubmit={submit} role="search" aria-label="Threads URL resolver">
        <span aria-hidden="true" style={{ alignSelf: "center", paddingLeft: 8 }}>
          🔗
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.hero.placeholder}
          inputMode="url"
          autoComplete="off"
          aria-label="Threads video URL"
        />
        <button type="button" className="btn btn-ghost" onClick={paste}>
          Paste
        </button>
        <button type="submit" className="btn">
          {t.hero.button} ↓
        </button>
      </form>
      <p className="trust-micro">🔒 {t.hero.trust}</p>
      <p className="example">{t.hero.example}</p>

      <div aria-live="polite">
        {status.kind === "loading" && (
          <p>
            <span className="spinner" aria-hidden="true" /> Resolving…
          </p>
        )}
        {status.kind === "error" && (
          <p className="status" role="alert">
            {(t.errors as Record<string, string>)[status.code] ?? FALLBACK_MSG[status.code]}
          </p>
        )}
        {status.kind === "done" && (
          <MediaResult post={status.post} onReset={() => setStatus({ kind: "idle" })} />
        )}
      </div>
    </div>
  );
}

function downloadHref(item: MediaItem, postId: string, index: number): { href: string; name: string } {
  const ext = item.extension || extensionFromMime(item.mimeType, item.type === "video" ? "mp4" : "jpg");
  const kind = item.type === "video" ? "video" : item.type === "image" ? "image" : "media";
  const name = mediaFilename(kind, postId || "post", index, ext);
  // Prefer the same-origin Worker download (correct Referer + filename).
  // Fall back to the direct media URL (e.g. mock mode without dl tokens).
  return { href: item.dl || item.url, name };
}

/**
 * Image with a fallback chain (proxy → direct URL) and a graceful
 * placeholder: never render an empty black box when a signed URL expired.
 */
function ImgWithFallback({
  src,
  fallbackSrc,
  alt,
  ratioStyle,
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
  ratioStyle?: React.CSSProperties;
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setCurrent(src);
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt + " (preview unavailable)"}
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 160,
          color: "var(--muted)",
          fontSize: 14,
          ...ratioStyle,
        }}
      >
        Preview unavailable — use Download below
      </div>
    );
  }
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      style={ratioStyle}
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc);
        else setFailed(true);
      }}
    />
  );
}

/**
 * Download via fetch so we can verify the payload BEFORE saving: the Worker
 * returns JSON errors (not media) when a link expired — saving those bytes
 * would produce a corrupt unplayable file. Only blobs with a media
 * content-type are saved; anything else surfaces a friendly error.
 */
async function saveDownload(href: string, name: string): Promise<void> {
  if (href.startsWith("http")) {
    // Direct third-party URL (e.g. mock mode): browser handles it.
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const res = await fetch(href);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !/^(video\/|image\/|audio\/)/.test(ct)) {
    throw new Error("DOWNLOAD_FAILED");
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("DOWNLOAD_FAILED");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function MediaResult({ post, onReset }: { post: ResolvedPost; onReset: () => void }) {
  const { t } = useI18n();
  const postId = post.postId || "post";
  const [busy, setBusy] = useState<string | null>(null);
  const [mp3Busy, setMp3Busy] = useState<string | null>(null);
  const [mp3Stage, setMp3Stage] = useState<Mp3Stage | null>(null);
  const [dlError, setDlError] = useState(false);
  const [mp3Error, setMp3Error] = useState(false);
  async function downloadOne(m: MediaItem, i: number) {
    const d = downloadHref(m, postId, i);
    setDlError(false);
    setBusy(m.id);
    try {
      await saveDownload(d.href, d.name);
    } catch {
      setDlError(true);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="result card">
      <AdSlot slot="above_result" />
      <strong>
        {t.result.found} · {post.mediaItems.length} {t.result.itemsFound}
      </strong>
      {post.username && <p className="example">@{post.username}</p>}
      {post.caption && <p>{post.caption}</p>}
      {dlError && (
        <p className="status" role="alert">
          The download failed (the link may have expired). Please resolve the post again and retry.
        </p>
      )}
      {mp3Error && (
        <p className="status" role="alert">
          Could not extract audio (file too large or unsupported). Try the video download instead.
        </p>
      )}
      <div className="media-grid">
        {post.mediaItems.map((m, i) => {
          return (
            <div className="media-card" key={m.id}>
              <div
                className="media-frame"
                style={
                  m.width && m.height
                    ? { aspectRatio: `${m.width} / ${m.height}` }
                    : undefined
                }
              >
                {m.type === "video" ? (
                  <video
                    src={m.dl || m.url}
                    poster={m.thumbnail}
                    controls
                    preload="metadata"
                    playsInline
                    aria-label={`Video ${i + 1}`}
                    style={m.width && m.height ? undefined : { aspectRatio: "16 / 9" }}
                  />
                ) : (
                  <ImgWithFallback
                    src={m.dl || m.thumbnail || m.url}
                    fallbackSrc={m.thumbnail && m.dl ? m.thumbnail : m.url}
                    alt={`${m.type} ${i + 1}`}
                    ratioStyle={m.width && m.height ? undefined : { aspectRatio: "4 / 5" }}
                  />
                )}
              </div>
              <div className="media-meta">
                <div>
                  {m.type} {i + 1}
                  {m.width && m.height ? ` · ${m.width} × ${m.height}` : ""}
                  {m.duration ? ` · 00:${String(m.duration).padStart(2, "0")}` : ""}
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 8, padding: "8px 14px", fontSize: 14 }}
                  disabled={busy !== null || mp3Busy !== null}
                  onClick={() => void downloadOne(m, i)}
                >
                  {busy === m.id ? "…" : t.result.download}
                </button>
                {m.type === "video" && (
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 8, marginLeft: 8, padding: "8px 14px", fontSize: 14 }}
                    disabled={busy !== null || mp3Busy !== null}
                    onClick={() =>
                      void (async () => {
                        const d = downloadHref(m, postId, i);
                        setMp3Error(false);
                        setMp3Busy(m.id);
                        setMp3Stage(null);
                        try {
                          const blob = await extractMp3(d.href, (s) => setMp3Stage(s));
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = mp3Filename(postId);
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          setTimeout(() => URL.revokeObjectURL(url), 10_000);
                        } catch {
                          setMp3Error(true);
                        } finally {
                          setMp3Busy(null);
                          setMp3Stage(null);
                        }
                      })()
                    }
                  >
                    {mp3Busy === m.id
                      ? mp3Stage === "fetch"
                        ? "Fetching…"
                        : mp3Stage === "decode"
                          ? "Decoding…"
                          : "Encoding…"
                      : "MP3"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="btn"
          disabled={busy !== null}
          onClick={() => {
            void (async () => {
              for (const [i, m] of post.mediaItems.entries()) {
                try {
                  const d = downloadHref(m, postId, i);
                  await saveDownload(d.href, d.name);
                } catch {
                  setDlError(true);
                  break;
                }
              }
            })();
          }}
        >
          {t.result.downloadAll}
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          {t.result.newDownload}
        </button>
      </div>
    </div>
  );
}

export function TrustRow() {
  const { t } = useI18n();
  const items = [
    { icon: "⚡", h: t.trustRow.fast, p: t.trustRow.fastDesc },
    { icon: "🛡", h: t.trustRow.safe, p: t.trustRow.safeDesc },
    { icon: "◎", h: t.trustRow.free, p: t.trustRow.freeDesc },
  ];
  return (
    <div className="grid3">
      {items.map((x) => (
        <div key={x.h} style={{ textAlign: "left" }}>
          <div className="dot" aria-hidden="true">
            {x.icon}
          </div>
          <strong>{x.h}</strong>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{x.p}</p>
        </div>
      ))}
    </div>
  );
}

export function HowTo() {
  const { t } = useI18n();
  const icons = ["🔗", "📋", "⬇", "✔"];
  return (
    <section className="section" id="how-to" aria-labelledby="howto-h">
      <div className="kicker">{t.howTo.kicker}</div>
      <h2 id="howto-h">{t.howTo.title}</h2>
      <p className="lead">{t.howTo.subtitle}</p>
      <div className="grid4">
        {t.howTo.steps.map((s: string, i: number) => (
          <div className="card" key={s}>
            <div className="step-num" aria-hidden="true">
              {icons[i]}
            </div>
            <h3>{s}</h3>
            <p>{t.howTo.descs[i]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Formats() {
  const { t } = useI18n();
  const icons = ["📄", "HD", "SD", "📱"];
  return (
    <section className="section" aria-labelledby="fmt-h">
      <div className="kicker">{t.formats.kicker}</div>
      <h2 id="fmt-h">{t.formats.title}</h2>
      <p className="lead">{t.formats.subtitle}</p>
      <div className="grid4">
        {t.formats.items.map((f: string, i: number) => (
          <div className="card" key={f}>
            <div style={{ fontSize: 28, fontWeight: 800 }} aria-hidden="true">
              {icons[i]}
            </div>
            <h3>{f}</h3>
            <p>{t.formats.descs[i]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WhyUs() {
  const { t } = useI18n();
  const icons = ["⚡", "🛡", "∞"];
  return (
    <section className="section" aria-labelledby="why-h">
      <div className="kicker" style={{ textAlign: "left" }}>
        {t.why.kicker}
      </div>
      <div className="why">
        <div>
          <h2 id="why-h" style={{ textAlign: "left" }}>
            {t.why.title}
          </h2>
          <p className="lead" style={{ textAlign: "left" }}>
            {t.why.subtitle}
          </p>
          {t.why.items.map((w: string, i: number) => (
            <div key={w} style={{ display: "flex", gap: 12, margin: "16px 0" }}>
              <div className="dot" aria-hidden="true">
                {icons[i]}
              </div>
              <div>
                <strong>{w}</strong>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{t.why.descs[i]}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="phone" role="img" aria-label="Video preview mockup">
          <span className="play" aria-hidden="true">
            ▶
          </span>
        </div>
      </div>
    </section>
  );
}

export const FAQ_ITEMS = [
  { q: "Is this Threads video downloader free to use?", a: "Yes. Paste a public Threads link and download the available media. No account or payment required." },
  { q: "Do I need to create an account?", a: "No. No Threads login, password or cookies are required. Only publicly accessible posts are supported." },
  { q: "Which videos can I download?", a: "Only videos from public posts that you can already open without logging in. Private posts are not supported." },
  { q: "What video quality can I download?", a: "Whatever quality the public post actually publishes (for example 1080p, 720p, 480p). We never fabricate quality options." },
  { q: "Is it safe to use?", a: "The tool runs link validation, rate limiting and safe downloads, and does not permanently store your links or files by default." },
  { q: "Why is my video not downloading?", a: "Usually the link is private, deleted, malformed, or from an unsupported domain. Only public threads.net and threads.com post URLs work." },
];

export function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section" aria-labelledby="faq-h">
      <div className="kicker">{t.faqSection.kicker}</div>
      <h2 id="faq-h">{t.faqSection.title}</h2>
      <p className="lead">{t.faqSection.subtitle}</p>
      <div className="faq card">
        {FAQ_ITEMS.map((f, i) => (
          <div className="faq-item" key={f.q}>
            <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span>{f.q}</span>
              <span aria-hidden="true">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && <p className="faq-a">{f.a}</p>}
          </div>
        ))}
      </div>
      <p className="example">
        <Link to="/faq">More answers →</Link>
      </p>
    </section>
  );
}

export function CtaBanner() {
  const { t } = useI18n();
  return (
    <div className="cta">
      <span className="brand-mark" aria-hidden="true">
        ⬇
      </span>
      <div>
        <strong>{t.cta.title}</strong>
        <p style={{ margin: 0, color: "var(--muted)" }}>{t.cta.subtitle}</p>
      </div>
    </div>
  );
}
