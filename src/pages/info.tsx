import { Link } from "react-router-dom";
import type { InfoBlock } from "../lib/info-pages";
import { INFO_PAGES } from "../lib/info-pages";
import { routeFor } from "../lib/seo-routes";
import { useSeo } from "./pages";
import { ContactForm } from "../components/contact-form";

/** Render the shared content blocks. Same text as the server-rendered HTML. */
function Blocks({ blocks }: { blocks: InfoBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return <h2 key={i}>{b.text}</h2>;
          case "h3":
            return <h3 key={i}>{b.text}</h3>;
          case "p":
            return <p key={i}>{b.text}</p>;
          case "note":
            return (
              <p key={i} className="note">
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/**
 * Informational / legal page.
 *
 * The copy comes from src/lib/info-pages.ts — the same module the Worker uses
 * to pre-render these routes — so the page a visitor reads and the HTML a
 * crawler receives are identical.
 */
export function InfoArticle({ path }: { path: string }) {
  useSeo(path);
  const route = routeFor(path);
  const content = INFO_PAGES[path];
  if (!content) return null;
  return (
    <article className="prose">
      <h1>{route.h1}</h1>
      <p className="lead">{content.intro}</p>
      {content.updated && <p className="updated">Last updated: {content.updated}</p>}
      <div className="card prose-card">
        <Blocks blocks={content.blocks} />
      </div>
      {content.related && content.related.length > 0 && (
        <nav className="related" aria-label="Related pages">
          <h2>Related pages</h2>
          <ul>
            {content.related.map((r) => (
              <li key={r.href}>
                <Link to={r.href}>{r.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}

/** /contact — the article plus the real, working contact form. */
export function ContactPage() {
  useSeo("/contact");
  const route = routeFor("/contact");
  const content = INFO_PAGES["/contact"];
  return (
    <article className="prose">
      <h1>{route.h1}</h1>
      <p className="lead">{content.intro}</p>
      {content.updated && <p className="updated">Last updated: {content.updated}</p>}
      <ContactForm />
      <div className="card prose-card">
        <Blocks blocks={content.blocks} />
      </div>
      {content.related && content.related.length > 0 && (
        <nav className="related" aria-label="Related pages">
          <h2>Related pages</h2>
          <ul>
            {content.related.map((r) => (
              <li key={r.href}>
                <Link to={r.href}>{r.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
