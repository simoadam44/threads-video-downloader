import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header, Footer, AdSlot } from "./components/chrome";
import { Home, ToolPage, InfoPage, FaqPage, BlogPage, NotFound } from "./pages/pages";
import { AdminLogin, AdminOverview, AdminRequests, AdminSettings } from "./pages/admin/admin";
import { KeywordsTools, BlogGuides } from "./pages/admin/content";
import { SeoWebmaster } from "./pages/admin/seo";
import { AdsenseAds } from "./pages/admin/ads";
import { DynamicToolRoute, DynamicGuidePage } from "./pages/dynamic";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <div className="container">
        <AdSlot slot="header" />
      </div>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/threads-video-downloader"
            element={
              <ToolPage
                path="/threads-video-downloader"
                extra="Paste a public Threads video URL above. The resolver detects available MP4 variants and shows only qualities that actually exist — best, 1080p, 720p or 480p — with preview, duration and thumbnail."
              />
            }
          />
          <Route
            path="/threads-photo-downloader"
            element={
              <ToolPage
                path="/threads-photo-downloader"
                extra="Paste a public Threads photo URL above. Each detected image shows preview, resolution and format with an individual download button."
              />
            }
          />
          <Route
            path="/threads-carousel-downloader"
            element={
              <ToolPage
                path="/threads-carousel-downloader"
                extra="Carousel posts are detected automatically. Every image and video gets its own preview and download button, plus a Download All option. ZIP export is intentionally not done in the Worker to avoid buffering large files in memory."
              />
            }
          />
          <Route
            path="/how-to-download-threads-videos"
            element={
              <InfoPage path="/how-to-download-threads-videos">
                <ol>
                  <li>Copy the public Threads link from the app or browser.</li>
                  <li>Paste it into the input box above.</li>
                  <li>Press Download, preview the detected media and save it.</li>
                </ol>
                <p>Works on iPhone, Android and desktop. No login required. Private posts are not supported.</p>
              </InfoPage>
            }
          />
          <Route path="/faq" element={<FaqPage />} />
          <Route
            path="/privacy"
            element={
              <InfoPage path="/privacy">
                <p>No Threads credentials required. Only public content is supported. Media and links are not permanently stored by default. If analytics are enabled, only minimal page events are collected.</p>
              </InfoPage>
            }
          />
          <Route
            path="/terms"
            element={
              <InfoPage path="/terms">
                <p>Acceptable use: public content only. You are responsible for having permission to download and use content. This is an independent third-party tool, not affiliated with Threads or Meta.</p>
              </InfoPage>
            }
          />
          <Route
            path="/contact"
            element={
              <InfoPage path="/contact">
                <p>Contact: contact@savethreadsvideos.com (configurable). Only download or use content you have permission to use. For copyright concerns include the post URL.</p>
              </InfoPage>
            }
          />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<DynamicGuidePage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/keywords-tools" element={<KeywordsTools />} />
          <Route path="/admin/blog-guides" element={<BlogGuides />} />
          <Route path="/admin/seo-webmaster" element={<SeoWebmaster />} />
          <Route path="/admin/adsense-ads" element={<AdsenseAds />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/:slug" element={<DynamicToolRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <div className="container">
        <AdSlot slot="footer" />
      </div>
      <Footer />
      <AdSlot slot="sticky" />
    </BrowserRouter>
  );
}
