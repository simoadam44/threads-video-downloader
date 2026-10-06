import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { DownloadForm, TrustRow, HowTo, Formats, WhyUs, Faq, CtaBanner, FAQ_ITEMS } from "../components/sections";
import { AdSlot } from "../components/chrome";
import { routeFor } from "../lib/seo-routes";
import { canonicalFor } from "../lib/site";
import { useEffect } from "react";

export function useSeo(path: string) {
  useEffect(() => {
    const r = routeFor(path);
    document.title = r.title;
    const set = (sel: string, attr: string, val: string, tag = "meta") => {
      let el = document.head.querySelector(`${tag}[${attr}="${sel}"]`) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(tag) as HTMLMetaElement;
        el.setAttribute(attr, sel);
        document.head.appendChild(el);
      }
      if (tag === "link") (el as HTMLLinkElement).href = val;
      else (el as HTMLMetaElement).content = val;
    };
    set("description", "name", r.description);
    set("og:title", "property", r.title);
    set("og:description", "property", r.description);
    set("og:url", "property", canonicalFor(path));
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalFor(path);
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
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>Blog</h1>
      <p className="lead">Guides for saving public Threads media responsibly on any device.</p>
      <div className="grid3">
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
