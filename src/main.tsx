import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { I18nProvider } from "./i18n";
import { bootstrapTracking } from "./lib/tracking-bootstrap";
import { bootstrapAds } from "./lib/ads-bootstrap";

// Tracking + ads bootstraps (GA4/Pixel/custom + AdSense auto-ads) — fire and forget.
void bootstrapTracking().catch(() => {});
void bootstrapAds().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
