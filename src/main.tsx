import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { I18nProvider } from "./i18n";
import { bootstrapTracking } from "./lib/tracking-bootstrap";
import { bootstrapAds } from "./lib/ads-bootstrap";

// Tracking + ads bootstraps (GA4/Pixel/custom + AdSense auto-ads) - fire and forget.
// Admin is a private, noindex dashboard served with a strict CSP: loading
// analytics there both pollutes reports with our own traffic and trips that
// policy, so it is skipped entirely.
const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
if (!isAdmin) {
  void bootstrapTracking().catch(() => {});
  void bootstrapAds().catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
