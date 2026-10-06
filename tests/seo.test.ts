import { describe, it, expect } from "vitest";
import { SEO_ROUTES } from "../src/lib/seo-routes";
import { canonicalFor } from "../src/lib/site";
import en from "../src/i18n/en.json";
import fr from "../src/i18n/fr.json";
import ar from "../src/i18n/ar.json";

describe("seo registry", () => {
  it("has unique paths and titles", () => {
    const paths = SEO_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    const titles = SEO_ROUTES.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
  it("builds canonical urls", () => {
    expect(canonicalFor("/faq")).toContain("/faq");
  });
});

describe("i18n", () => {
  it("fr/ar mirror top-level keys of en", () => {
    for (const k of Object.keys(en)) {
      expect(fr).toHaveProperty(k);
      expect(ar).toHaveProperty(k);
    }
  });
});
