import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header, Footer, AdSlot } from "./components/chrome";
import { Home, ToolPage, FaqPage, BlogPage, NotFound } from "./pages/pages";
import { InfoArticle, ContactPage } from "./pages/info";
import { AdminLogin, AdminOverview, AdminRequests, AdminMessages, AdminSettings } from "./pages/admin/admin";
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
          <Route path="/threads-video-downloader" element={<ToolPage path="/threads-video-downloader" />} />
          <Route path="/threads-photo-downloader" element={<ToolPage path="/threads-photo-downloader" />} />
          <Route path="/threads-carousel-downloader" element={<ToolPage path="/threads-carousel-downloader" />} />
          <Route path="/how-to-download-threads-videos" element={<InfoArticle path="/how-to-download-threads-videos" />} />
          <Route path="/how-to-use" element={<InfoArticle path="/how-to-use" />} />
          <Route path="/about" element={<InfoArticle path="/about" />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy" element={<InfoArticle path="/privacy" />} />
          <Route path="/terms" element={<InfoArticle path="/terms" />} />
          <Route path="/disclaimer" element={<InfoArticle path="/disclaimer" />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<DynamicGuidePage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
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
