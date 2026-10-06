import { describe, it, expect } from "vitest";
import {
  isValidSlug,
  validateToolPage,
  validateGuide,
  sanitizeGuideHtml,
  buildRelated,
  parseFaqs,
  type LinkNode,
} from "../src/server/content/types";

const goodTool = {
  slug: "threads-video-downloader-hd",
  badge: "HD",
  lang: "en",
  target_keyword: "Threads Video Downloader",
  title: "Threads Video Downloader HD - Save Public Threads Videos in High Quality",
  description:
    "Paste a public Threads video link and save the available MP4 in the best published quality. Fast, free, no login required, works on mobile.",
  h1: "Threads Video Downloader HD",
  intro: "This intro is long enough to satisfy the no-thin-content rule with more than one hundred characters of real text.",
  faqs: [
    { q: "How do I download a video here?", a: "Copy the public link, paste it above, and press download to save the file." },
    { q: "Is an account needed for this?", a: "No account is ever needed because only publicly accessible posts are supported." },
    { q: "What quality will I receive?", a: "The best rendition the post actually published, shown before you save anything." },
  ],
  related_slugs: [],
  status: "live",
};

describe("slug validation", () => {
  it("accepts latin and arabic slugs", () => {
    expect(isValidSlug("threads-video-hd")).toBe(true);
    expect(isValidSlug("تحميل-فيديو-ثريدز")).toBe(true);
  });
  it("rejects bad slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Has Space")).toBe(false);
    expect(isValidSlug("/admin")).toBe(false);
    expect(isValidSlug("x".repeat(121))).toBe(false);
  });
});

describe("tool validation (no thin content)", () => {
  it("accepts a complete page", () => {
    expect(validateToolPage(goodTool)).toBe(null);
  });
  it("rejects thin/short/duplicated meta", () => {
    expect(validateToolPage({ ...goodTool, title: "Short" })).toContain("30-160");
    expect(validateToolPage({ ...goodTool, description: "too short" })).toContain("120-320");
    expect(validateToolPage({ ...goodTool, intro: "thin" })).toContain("no thin");
    expect(validateToolPage({ ...goodTool, faqs: [{ q: "Q?", a: "short" }] })).toContain("3 FAQs");
    expect(validateToolPage({ ...goodTool, status: "archived" })).toContain("draft or live");
  });
});

describe("guide validation", () => {
  const goodGuide = { ...goodTool, body: "x".repeat(800) };
  it("accepts long guides", () => {
    expect(validateGuide(goodGuide)).toBe(null);
  });
  it("rejects short bodies", () => {
    expect(validateGuide({ ...goodGuide, body: "short" })).toContain("800");
  });
});

describe("sanitizeGuideHtml", () => {
  it("strips scripts, iframes and handlers but keeps content", () => {
    const out = sanitizeGuideHtml('<p>Hello</p><script>alert(1)</script><a href="javascript:x" onclick="y()">t</a><img src="https://x.test/a.jpg" alt="a" />');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("<p>Hello</p>");
    expect(out).toContain('src="https://x.test/a.jpg"');
  });
  it("drops non-http image sources", () => {
    expect(sanitizeGuideHtml('<img src="data:image/png;base64,xx" />')).not.toContain("<img");
  });
});

describe("buildRelated cross-linking", () => {
  const pool: LinkNode[] = [
    { kind: "tool", slug: "a", title: "A", lang: "en", target_keyword: "Threads Video Downloader" },
    { kind: "tool", slug: "b", title: "B", lang: "ar", target_keyword: "تحميل فيديو ثريدز" },
    { kind: "guide", slug: "c", title: "C", lang: "en", target_keyword: "Threads Video Downloader Android" },
  ];
  it("prefers explicit slugs, excludes self", () => {
    const out = buildRelated(
      { slug: "a", lang: "en", target_keyword: "Threads Video", related_slugs: ["b", "a"] },
      pool,
    );
    expect(out[0].slug).toBe("b");
    expect(out.some((n) => n.slug === "a")).toBe(false);
  });
  it("auto-fills by language + shared keywords", () => {
    const out = buildRelated({ slug: "z", lang: "en", target_keyword: "Threads Video", related_slugs: [] }, pool);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].lang).toBe("en");
  });
  it("caps at max", () => {
    const out = buildRelated({ slug: "z", lang: "en", target_keyword: "Threads", related_slugs: [] }, pool, 1);
    expect(out).toHaveLength(1);
  });
});

describe("parseFaqs", () => {
  it("parses JSON strings and arrays, rejects garbage", () => {
    expect(parseFaqs('[{"q":"a","b":1}]')).toHaveLength(1);
    expect(parseFaqs("nope")).toEqual([]);
    expect(parseFaqs([{ q: "x", a: "y" }])).toHaveLength(1);
  });
});
