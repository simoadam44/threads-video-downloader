import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DownloadForm, Faq } from "../components/sections";
import { applyPageSeo } from "../lib/site";

interface FaqItem {
  q: string;
  a: string;
}

interface ToolContent {
  slug: string;
  badge: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  faqs: FaqItem[];
}

interface GuideContent {
  slug: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  faqs: FaqItem[];
}

async function fetchContent<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const data = (await res.json()) as { success: boolean; data?: T };
    return data.success && data.data ? data.data : null;
  } catch {
    return null;
  }
}

/** DB-driven landing tool page (client-rendered; server HTML covers SEO). */
export function DynamicToolPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<ToolContent | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    document.documentElement.lang = "en";
    fetchContent<ToolContent>(`/api/content/tool/${slug}`).then((p) => {
      if (p) {
        setPage(p);
        applyPageSeo({
          title: p.title,
          description: p.description,
          canonicalPath: `/${p.slug}`,
          ogType: "website",
        });
        if (p.lang) document.documentElement.lang = p.lang;
        document.documentElement.dir = p.lang === "ar" ? "rtl" : "ltr";
      } else {
        setMissing(true);
        applyPageSeo({
          title: "Page not found - Threads Video Downloader",
          description: "This page does not exist.",
          canonicalPath: `/${slug}`,
          robots: "noindex, nofollow",
        });
      }
    });
  }, [slug]);
  if (missing) {
    return (
      <section className="section">
        <h1>Page not found</h1>
        <p>
          <Link className="btn" to="/" style={{ textDecoration: "none" }}>
            Back to home
          </Link>
        </p>
      </section>
    );
  }
  if (!page) return <section className="section"><p>Loading…</p></section>;
  return (
    <>
      <div className="hero">
        <span className="pill">{page.badge || page.target_keyword}</span>
        <h1>{page.h1}</h1>
        <p className="sub">{page.description}</p>
        <DownloadForm />
      </div>
      <section className="section" style={{ textAlign: "left" }}>
        <div className="card"><p>{page.intro}</p></div>
      </section>
      <Faq />
    </>
  );
}

export function DynamicToolRoute() {
  const { slug } = useParams();
  if (!slug) return null;
  return <DynamicToolPage key={slug} slug={slug} />;
}

/** DB-driven long-tail guide under /blog/:slug. */
export function DynamicGuidePage() {
  const { slug } = useParams();
  const [guide, setGuide] = useState<GuideContent | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!slug) return;
    fetchContent<GuideContent>(`/api/content/guide/${slug}`).then((g) => {
      if (g) {
        setGuide(g);
        applyPageSeo({
          title: g.title,
          description: g.description,
          canonicalPath: `/blog/${g.slug}`,
          ogType: "article",
        });
        if (g.lang) document.documentElement.lang = g.lang;
        document.documentElement.dir = g.lang === "ar" ? "rtl" : "ltr";
      } else {
        setMissing(true);
        applyPageSeo({
          title: "Page not found - Threads Video Downloader",
          description: "This guide does not exist.",
          canonicalPath: `/blog/${slug}`,
          robots: "noindex, nofollow",
        });
      }
    });
  }, [slug]);
  if (missing) {
    return (
      <section className="section">
        <h1>Guide not found</h1>
        <p>
          <Link className="btn" to="/blog" style={{ textDecoration: "none" }}>
            All guides
          </Link>
        </p>
      </section>
    );
  }
  if (!guide) return <section className="section"><p>Loading…</p></section>;
  return (
    <section className="section" style={{ textAlign: "left" }}>
      <h1>{guide.h1}</h1>
      <p className="lead">{guide.description}</p>
      <div className="card">
        <div dangerouslySetInnerHTML={{ __html: guide.body }} />
        {guide.faqs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h2>Frequently Asked Questions</h2>
            {guide.faqs.map((f) => (
              <div key={f.q} style={{ marginBottom: 12 }}>
                <strong>{f.q}</strong>
                <p style={{ color: "var(--muted)" }}>{f.a}</p>
              </div>
            ))}
          </div>
        )}
        <p>
          <Link to="/">Try the downloader →</Link>
        </p>
      </div>
    </section>
  );
}
