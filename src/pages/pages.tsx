import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { DownloadForm, TrustRow, HowTo, Formats, WhyUs, Faq, CtaBanner, FAQ_ITEMS } from "../components/sections";
import { AdSlot } from "../components/chrome";
import { routeFor } from "../lib/seo-routes";
import { applyPageSeo } from "../lib/site";
import { useEffect, useState } from "react";

export function useSeo(path: string) {
  useEffect(() => {
    const r = routeFor(path);
    applyPageSeo({ title: r.title, description: r.description, canonicalPath: path, ogType: "website" });
  }, [path]);
}

export function Hero({ h1, sub }: { h1: string; sub: string }) {
  const { t } = useI18n();
  return (
    <div className="hero">
      <span className="pill">⚡ {t.hero.badge}</span>
      <h1>{h1}</h1>
      <p className="sub">{sub}</p>
      <DownloadForm />
      <AdSlot slot="below_search" />
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  useSeo("/");
  return (
    <>
      <Hero h1={t.hero.title} sub={t.hero.subtitle} />
      <TrustRow />
      <HowTo />
      <AdSlot slot="midpage" />
      <Formats />
      <WhyUs />
      <Faq />
      <CtaBanner />
    </>
  );
}

export function ToolPage({ path, extra }: { path: string; extra: string }) {
  const r = routeFor(path);
  useSeo(path);
  return (
    <>
      <Hero h1={r.h1} sub={r.description} />
      <section className="section" style={{ textAlign: "left" }}>
        <div className="card">
          <p>{extra}</p>
          <p>
            <Link to="/how-to-download-threads-videos">How to download Threads videos →</Link>
            {" · "}
            <Link to="/threads-photo-downloader">Photo downloader →</Link>
            {" · "}
            <Link to="/threads-carousel-downloader">Carousel downloader →</Link>
          </p>
        </div>
      </section>
      <Faq />
      <CtaBanner />
    </>
  );
}

export function InfoPage({ path, children }: { path: string; children: React.ReactNode }) {
  const r = routeFor(path);
  useSeo(path);
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>{r.h1}</h1>
      <p className="lead">{r.description}</p>
      <div className="card">{children}</div>
    </section>
  );
}

export function FaqPage() {
  useSeo("/faq");
  const { t } = useI18n();
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>{t.faqSection.title}</h1>
      <div className="card">
        {FAQ_ITEMS.map((f) => (
          <div key={f.q} style={{ marginBottom: 16 }}>
            <strong>{f.q}</strong>
            <p style={{ color: "var(--muted)" }}>{f.a}</p>
          </div>
        ))}
        <p style={{ color: "var(--muted)" }}>
          This is an independent third-party tool. Only publicly accessible content is supported; private posts,
          login credentials and workarounds for access controls are never supported. Media is not permanently
          stored by default.
        </p>
      </div>
    </section>
  );
}

export function BlogPage() {
  useSeo("/blog");
  const [live, setLive] = useState<{ slug: string; title: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/content/guides")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && j.success && Array.isArray(j.data)) {
          setLive(
            j.data
              .filter((g: unknown) => g && typeof (g as { slug?: unknown }).slug === "string" && typeof (g as { title?: unknown }).title === "string")
              .map((g: { slug: string; title: string }) => ({ slug: g.slug, title: g.title })),
          );
        }
      })
      .catch(() => {
        /* static fallback below stays */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>Blog</h1>
      <p className="lead">Guides for saving public Threads media responsibly on any device.</p>
      <div className="grid3">
        {live.map((g) => (
          <div className="card" key={`db-${g.slug}`}>
            <h3>{g.title}</h3>
            <p>
              <Link to={`/blog/${g.slug}`}>Read guide →</Link>
            </p>
          </div>
        ))}
        {[
          ["How to Download Threads Videos", "/how-to-download-threads-videos"],
          ["Threads Photo Downloader", "/threads-photo-downloader"],
          ["Threads Carousel Downloader", "/threads-carousel-downloader"],
        ].map(([title, href]) => (
          <div className="card" key={href}>
            <h3>{title}</h3>
            <p>
              <Link to={href}>Read guide →</Link>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = "Not found - Threads Video Downloader";
  }, []);
  return (
    <section className="section">
      <h1>Page not found</h1>
      <p className="lead">This link does not exist.</p>
      <p>
        <Link className="btn" to="/" style={{ textDecoration: "none" }}>
          Back to home
        </Link>
      </p>
    </section>
  );
}
