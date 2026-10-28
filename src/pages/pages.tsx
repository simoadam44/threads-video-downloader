import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { DownloadForm, TrustRow, HowTo, Formats, WhyUs, Faq, CtaBanner, FAQ_ITEMS } from "../components/sections";
import { AdSlot } from "../components/chrome";
import { routeFor } from "../lib/seo-routes";
import { toolContentFor } from "../lib/tool-content";
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

export function ToolPage({ path }: { path: string }) {
  const r = routeFor(path);
  const content = toolContentFor(path);
  useSeo(path);
  return (
    <>
      <Hero h1={r.h1} sub={r.description} />
      <section className="section" style={{ textAlign: "left" }}>
        <div className="card">
          {/* Same summary the Worker pre-renders for crawlers (registry = single source). */}
          {r.summary && <p>{r.summary}</p>}
          <p>
            <Link to="/how-to-use">How to use this downloader →</Link>
            {" · "}
            <Link to="/threads-photo-downloader">Photo downloader →</Link>
            {" · "}
            <Link to="/threads-carousel-downloader">Carousel downloader →</Link>
          </p>
        </div>
      </section>
      {/* Long-form copy from src/lib/tool-content.ts — the same blocks the
          Worker pre-renders, so crawler and visitor read identical text. */}
      {content && (
        <section className="section" style={{ textAlign: "left" }}>
          <div className="prose">
            {content.sections.map((s, i) => (
              <div key={i}>
                <h2>{s.h2}</h2>
                {s.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <h2>Frequently Asked Questions</h2>
            {content.faqs.map((f, i) => (
              <div key={i}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {!content && <Faq />}
      <CtaBanner />
    </>
  );
}

export function FaqPage() {
  useSeo("/faq");
  const { t } = useI18n();
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>{t.faqSection.title}</h1>
      <p className="lead">
        Short, factual answers about what this downloader does, what it cannot do, and how it treats your data.
      </p>
      <div className="card prose-card">
        <h2>Common questions</h2>
        {FAQ_ITEMS.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
      <p className="example">
        Still stuck? <Link to="/contact">Contact us</Link> with the post link. The <Link to="/how-to-use">how-to-use
        guide</Link> covers every error message, and the <Link to="/privacy">privacy policy</Link> explains what happens
        to the links you paste.
      </p>
      <p className="example">
        This is an independent third-party tool. Only publicly accessible content is supported; private posts, login
        credentials and workarounds for access controls are never supported. Media is not stored on our servers.
      </p>
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
          ["How to Use the Downloader", "/how-to-use"],
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
