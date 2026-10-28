import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, type Lang } from "../i18n";
import type { AdSlotName } from "../server/content/ads";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("tvd-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="example" style={{ margin: 0 }}>
        Lang
      </span>
      <select
        className="icon-btn"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language"
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
        <option value="ar">AR</option>
      </select>
    </label>
  );
}

export function Header() {
  const { t } = useI18n();
  return (
    <header className="site">
      <div className="container nav">
        <Link className="brand" to="/" aria-label="Threads Video Downloader home">
          <span className="brand-mark" aria-hidden="true">
            ⬇
          </span>
          <span>Threads Video Downloader</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link to="/">{t.header.home}</Link>
          <Link to="/how-to-use">{t.header.howTo}</Link>
          <Link to="/threads-video-downloader">{t.header.features}</Link>
          <Link to="/faq">{t.header.faq}</Link>
          <Link to="/blog">{t.header.blog}</Link>
        </nav>
        <div className="nav-actions">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site">
      <div className="container">
        <div className="cols">
          <div>
            <strong>Threads Video Downloader</strong>
            <p style={{ fontSize: 14 }}>Fast, free and secure public Threads media saver.</p>
          </div>
          <div>
            <strong>Quick Links</strong>
            <br />
            <Link to="/how-to-use">How to Use</Link>
            <br />
            <Link to="/faq">FAQ</Link>
            <br />
            <Link to="/blog">Blog</Link>
          </div>
          <div>
            <strong>Legal &amp; Support</strong>
            <br />
            <Link to="/contact">Contact Us</Link>
            <br />
            <Link to="/privacy">Privacy Policy</Link>
            <br />
            <Link to="/terms">Terms of Use</Link>
            <br />
            <Link to="/disclaimer">Disclaimer</Link>
          </div>
          <div>
            <strong>About</strong>
            <br />
            <Link to="/about">About Us</Link>
            <br />
            <Link to="/threads-video-downloader">Video Downloader</Link>
            <br />
            <Link to="/threads-photo-downloader">Photo Downloader</Link>
            <br />
            <Link to="/threads-carousel-downloader">Carousel Downloader</Link>
          </div>
        </div>
        <small>{t.footer.disclaimer}</small>
        <small>© {new Date().getFullYear()} Threads Video Downloader. All rights reserved.</small>
      </div>
    </footer>
  );
}

interface AdsState {
  pubId: string;
  autoAds: boolean;
  slots: Record<AdSlotName, boolean>;
}

let adsCache: Promise<AdsState | null> | null = null;

function getAdsState(): Promise<AdsState | null> {
  if (!adsCache) {
    adsCache = fetch("/api/ads.json")
      .then((r) => (r.ok ? (r.json() as Promise<AdsState>) : null))
      .catch(() => null);
  }
  return adsCache;
}

function pushAdsense(): void {
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] };
    w.adsbygoogle = w.adsbygoogle || [];
    w.adsbygoogle.push({});
  } catch {
    /* ads blocked or unavailable */
  }
}

/**
 * Real ad slot: renders nothing unless the publisher ID is set and this
 * placement is enabled. Reserves fixed space (no layout shift) and loads
 * AdSense responsively. Sticky dock includes a close button.
 */
export function AdSlot({ slot }: { slot: AdSlotName }) {
  const [ads, setAds] = useState<AdsState | null>(null);
  const [closed, setClosed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    getAdsState().then((a) => {
      if (alive) {
        setAds(a);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (ready && ads && ads.pubId && ads.slots[slot]) pushAdsense();
  }, [ready, ads, slot]);
  if (!ready || !ads || !ads.pubId || !ads.slots[slot]) return null;
  if (slot === "sticky" && closed) return null;
  if (slot === "sticky") {
    return (
      <div className="ad-sticky" role="complementary" aria-label="Advertisement">
        <button className="ad-close" onClick={() => setClosed(true)} aria-label="Close advertisement">
          ✕
        </button>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ads.pubId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }
  return (
    <div className={`ad-slot ad-slot-${slot}`} role="complementary" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ads.pubId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
