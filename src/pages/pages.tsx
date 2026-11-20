import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { DownloadForm, TrustRow, HowTo, Formats, WhyUs, Faq, CtaBanner, FAQ_ITEMS } from "../components/sections";
import { AdSlot } from "../components/chrome";
import { routeFor, siblingsFor } from "../lib/seo-routes";
import { toolContentFor } from "../lib/tool-content";
import { HOME_FAQS, HOME_LINKS, HOME_SECTIONS } from "../lib/home-content";
import { BLOG_INTRO, BLOG_LINKS, BLOG_SECTIONS } from "../lib/blog-content";
import { localizedHomeFor } from "../lib/localized-home";
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
      {/* Long-form copy from src/lib/home-content.ts — the same blocks the
          Worker pre-renders, so the crawlable HTML and the visible page carry
          identical text. The FAQ here is intentionally not FAQ_ITEMS (that
          block belongs to /faq alone). */}
      <section className="section" style={{ textAlign: "left" }}>
        <div className="prose">
          {HOME_SECTIONS.map((s, i) => (
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
          {HOME_FAQS.map((f, i) => (
            <div key={i}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section" style={{ textAlign: "left" }} aria-label="Explore the downloader">
        <div className="card">
          <h2>Where to go next</h2>
          {HOME_LINKS.map((l) => (
            <div key={l.href}>
              <h3>
                <Link to={l.href}>{l.label}</Link>
              </h3>
              <p>{l.summary}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBanner />
    </>
  );
}

/**
 * Real localized homepage (/ar, /fr). Copy comes from the same module the
 * Worker pre-renders, so the hydrated page and the crawlable HTML agree. The
 * language context is initialised from the path in src/i18n/index.tsx, which
 * is why the form and the surrounding controls already speak the page language
 * on the first render.
 */
export function LocalizedHomePage({ path }: { path: string }) {
  const page = localizedHomeFor(path);
  useSeo(path);
  if (!page) return <NotFound />;
  return (
    <>
      <div className="hero">
        <h1>{page.h1}</h1>
        <p className="sub">{page.intro}</p>
        <DownloadForm />
        <AdSlot slot="below_search" />
      </div>
      <section className="section" style={{ textAlign: "left" }} lang={page.lang} dir={page.dir}>
        <div className="prose">
          {page.sections.map((s, i) => (
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
          <h2>{page.faqTitle}</h2>
          {page.faqs.map((f, i) => (
            <div key={i}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
          <p>
            <Link to="/">{page.englishLabel}</Link>
          </p>
        </div>
      </section>
    </>
  );
}

export function ToolPage({ path }: { path: string }) {  const r = routeFor(path);
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
            {siblingsFor(path).map((l, i) => (
              <span key={l.path}>
                {i > 0 && " · "}
                <Link to={l.path}>{l.label}</Link>
              </span>
            ))}
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
      {/* Same copy as the Worker pre-renders (src/lib/blog-content.ts), so the
          hydrated page and the crawlable HTML cannot drift. */}
      <p>{BLOG_INTRO}</p>
      <div className="prose">
        {BLOG_SECTIONS.map((s, i) => (
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
      </div>
      <h2>Latest guides</h2>
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
      <h2>Where to go next</h2>
      <div className="grid3">
        {BLOG_LINKS.map((l) => (
          <div className="card" key={l.href}>
            <h3>
              <Link to={l.href}>{l.label}</Link>
            </h3>
            <p>{l.summary}</p>
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
