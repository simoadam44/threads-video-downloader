import { describe, it, expect, vi, afterEach } from "vitest";
import { GeminiProvider } from "../src/server/ai/gemini";
import { aiConfig, getAiProvider } from "../src/server/ai";
import { AiError, maskApiKey, sanitizeSlug } from "../src/server/ai/types";
import { validateSetting } from "../src/server/db/types";
import { validateToolPage, validateGuide } from "../src/server/content/types";
import { GEMINI_MODELS, DEFAULT_AI_MODEL } from "../src/lib/ai-models";
import { sanitizeApiKey } from "../src/lib/keys";

const KEY = "AIza" + "A".repeat(35);

function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function geminiBody(json: unknown): unknown {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] };
}

const TOOL_JSON = {
  slug: "download-threads-reels-on-iphone",
  badge: "HD VIDEO",
  title: "Download Threads Reels on iPhone in HD Quality",
  description:
    "Learn how to download Threads reels on iPhone in HD: paste the public link, preview the video and save the best available MP4 without an app.",
  h1: "Download Threads Reels on iPhone",
  intro:
    "iPhone users can save public Threads reels in a few taps: copy the post link from the share sheet, paste it into the downloader above and pick the resolution that suits your device. The tool fetches the original MP4 that the poster published, so what you save is exactly what was uploaded — nothing is re-compressed or watermarked. Works in Safari and Chrome on iOS 15 and later, and no Threads account is needed.",
  faqs: [
    { q: "Can I save Threads reels to my iPhone camera roll?", a: "Yes — after downloading, open the file and use the share sheet to save it to Photos." },
    { q: "Does this work in Safari on iOS?", a: "Yes, the downloader works in Safari and Chrome on any modern iPhone without installing an app." },
    { q: "Do I need a Threads account to download?", a: "No. Only the public post link is needed; no login, password or cookies are requested." },
    { q: "What quality will I get on iPhone?", a: "You get the best MP4 resolution the post was published with, up to 1080p when available." },
  ],
  related_slugs: ["threads-video-downloader", "how-to-download-threads-videos"],
};

const GUIDE_JSON = {
  slug: "save-threads-carousel-photos",
  title: "How to Save Every Photo from a Threads Carousel Post",
  description:
    "Step-by-step guide to saving all images and videos from a public Threads carousel post, including mixed carousels, order, and what to do when a link has no media.",
  h1: "How to Save Every Photo from a Threads Carousel Post",
  body: `<h2>What a carousel post contains</h2><p>A Threads carousel can mix photos and videos in one post. When you paste the link into the downloader, every media item in the post is detected and listed with its own preview, type and resolution.</p><h2>Save them one by one</h2><p>Each item has its own download button, so you can grab only the images you need. Tap the preview to confirm it is the right photo before saving.</p><h2>Save everything at once</h2><p>Use the Download All button to save each media item in sequence. Your browser may ask permission for multiple downloads the first time — allow it for the session.</p><h2>When the link has no media</h2><p>Text-only posts and posts from private accounts have nothing to download; the tool tells you clearly instead of guessing. Check that the post is public and the link points to the post itself, not a profile.</p><h2>Recap</h2><p>Copy the public post link, paste it into the downloader, preview the detected carousel items, then save them individually or all at once.</p>`,
  faqs: [
    { q: "Can I download a mixed carousel of images and videos?", a: "Yes — every image and video in the carousel is detected and each item can be saved separately." },
    { q: "Is there a limit on how many items I can save?", a: "No artificial limit; the downloader lists all media items found in the public post." },
    { q: "Why does my link say no media was found?", a: "The post may be text-only, private, or deleted. Only public posts with media can be downloaded." },
    { q: "Does the order of saved photos match the post?", a: "The detected items are listed in the same order they appear in the post." },
  ],
  related_slugs: ["threads-carousel-downloader"],
};

const CONTEXT = {
  existingTitles: ["Threads Video Downloader - Save Public Threads Videos in HD", "How to Download Threads Videos - 3 Simple Steps"],
  existingFaqQuestions: ["Is this Threads video downloader free to use?", "Can I download Threads photos?"],
  allowedSlugs: ["threads-video-downloader", "how-to-download-threads-videos", "threads-carousel-downloader"],
  linkPaths: ["/threads-video-downloader", "/blog/save-threads-carousel-photos"],
};

describe("AI settings validation + masking", () => {
  it("accepts valid Gemini keys and empty (clear)", () => {
    expect(validateSetting("gemini_api_key", KEY)).toBe(true);
    expect(validateSetting("gemini_api_key", "")).toBe(true);
    // Newer/longer AI Studio keys must also pass (Google is the final judge).
    expect(validateSetting("gemini_api_key", "AIza" + "B".repeat(100))).toBe(true);
    expect(validateSetting("gemini_api_key", "AIza" + "C".repeat(10))).toBe(true);
    // Current Auth-key format issued by AI Studio (Oct 2026): "AQ.…".
    // Built at runtime so no key-shaped literal is ever committed.
    expect(validateSetting("gemini_api_key", "AQ." + "Ab8RN6Ih".repeat(5))).toBe(true);
    expect(validateSetting("gemini_api_key", "AQ." + "x".repeat(10))).toBe(true);
    expect(validateSetting("gemini_api_key", "not-a-key")).toBe(false);
    expect(validateSetting("gemini_api_key", "AIzaSHORT")).toBe(false);
    expect(validateSetting("gemini_api_key", "AQ.short")).toBe(false);
    expect(validateSetting("gemini_api_key", "AIza" + "D".repeat(121))).toBe(false);
    expect(validateSetting("gemini_api_key", "AIza with spaces inside key")).toBe(false);
  });
  it("accepts only known models", () => {
    expect(validateSetting("gemini_model", DEFAULT_AI_MODEL)).toBe(true);
    for (const m of GEMINI_MODELS) expect(validateSetting("gemini_model", m)).toBe(true);
    expect(validateSetting("gemini_model", "gpt-4")).toBe(false);
    expect(validateSetting("gemini_model", "")).toBe(false);
  });
  it("masks keys without ever exposing them", () => {
    expect(maskApiKey(KEY)).toBe("AIza…AAAA");
    expect(maskApiKey(KEY)).not.toContain("AAAA".repeat(8));
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey("short")).toBe("sh…");
  });
  it("resolves config: env secrets beat DB settings", () => {
    expect(aiConfig({ GEMINI_API_KEY: KEY }, { gemini_api_key: "ignored" }).apiKey).toBe(KEY);
    expect(aiConfig({}, { gemini_api_key: KEY, gemini_model: "gemini-3.8-flash" })).toEqual({ apiKey: KEY, model: "gemini-3.8-flash" });
    expect(aiConfig({}, {})).toEqual({ apiKey: "", model: DEFAULT_AI_MODEL });
    expect(() => getAiProvider({ apiKey: "", model: DEFAULT_AI_MODEL })).toThrow(AiError);
  });
});

describe("GeminiProvider — successful generation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes a tool draft that passes the site's own validation", async () => {
    stubFetch(() => okResponse(geminiBody(TOOL_JSON)));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    const draft = await p.generate({ kind: "tool", targetKeyword: "download threads reels on iphone", lang: "en", context: CONTEXT });
    expect(draft.kind).toBe("tool");
    if (draft.kind !== "tool") return;
    expect(draft.faqs.length).toBe(4);
    expect(draft.related_slugs).toEqual(["threads-video-downloader", "how-to-download-threads-videos"]);
    const input: Record<string, unknown> = {
      slug: draft.slug, badge: draft.badge, lang: "en", target_keyword: "download threads reels",
      title: draft.title, description: draft.description, h1: draft.h1, intro: draft.intro,
      faqs: draft.faqs, related_slugs: draft.related_slugs, status: "draft",
    };
    expect(validateToolPage(input)).toBeNull();
  });

  it("normalizes a guide draft that passes the site's own validation", async () => {
    stubFetch(() => okResponse(geminiBody(GUIDE_JSON)));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    const draft = await p.generate({ kind: "guide", targetKeyword: "save threads carousel photos", lang: "en", context: CONTEXT });
    expect(draft.kind).toBe("guide");
    if (draft.kind !== "guide") return;
    expect(draft.body).toContain("<h2>");
    const input: Record<string, unknown> = {
      slug: draft.slug, lang: "en", target_keyword: "save threads carousel photos",
      title: draft.title, description: draft.description, h1: draft.h1, body: draft.body,
      faqs: draft.faqs, related_slugs: draft.related_slugs, status: "draft",
    };
    expect(validateGuide(input)).toBeNull();
  });

  it("strips code fences and concatenates multiple response parts", async () => {
    const half = JSON.stringify(TOOL_JSON);
    const body = { candidates: [{ content: { parts: [{ text: "```json\n" + half.slice(0, 50) }, { text: half.slice(50) + "\n```" }] } }] };
    stubFetch(() => okResponse(body));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    const draft = await p.generate({ kind: "tool", targetKeyword: "x", lang: "en", context: { ...CONTEXT, existingTitles: [], existingFaqQuestions: [] } });
    expect(draft.title).toBe(TOOL_JSON.title);
  });

  it("filters related slugs to the allowed pool and drops weak FAQs", async () => {
    const messy = { ...TOOL_JSON, related_slugs: ["evil-slug", "threads-video-downloader"], faqs: [...TOOL_JSON.faqs, { q: "Short?", a: "too short" }] };
    stubFetch(() => okResponse(geminiBody(messy)));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    const draft = await p.generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT });
    expect(draft.related_slugs).toEqual(["threads-video-downloader"]);
    expect(draft.faqs.length).toBe(4);
  });

  it("sends the key only as x-goog-api-key and includes the uniqueness context", async () => {
    const fn = stubFetch(() => okResponse(geminiBody(GUIDE_JSON)));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    await p.generate({ kind: "guide", targetKeyword: "x", lang: "en", context: CONTEXT });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(":generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    expect(url).not.toContain(KEY); // never in the URL (logs)
    expect(String(init.body)).not.toContain(KEY); // never in the prompt/schema
    const body = JSON.parse(String(init.body)) as { contents: { parts: { text: string }[] }[] };
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain(CONTEXT.existingTitles[0]);
    expect(prompt).toContain(CONTEXT.existingFaqQuestions[0]);
    expect(prompt).toContain("/blog/save-threads-carousel-photos");
  });
  it("uses the legacy REST structured-output fields the endpoint accepts", async () => {
    const fn = stubFetch(() => okResponse(geminiBody(TOOL_JSON)));
    const p = new GeminiProvider(KEY, DEFAULT_AI_MODEL);
    await p.generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT });
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { generationConfig: Record<string, unknown> };
    // The v1beta REST endpoint rejects responseFormat.text.mimeType enum values —
    // use the classic string fields instead (single variable under test).
    expect(payload.generationConfig["response_mime_type"]).toBe("application/json");
    expect(payload.generationConfig["response_schema"]).toMatchObject({ type: "object" });
    expect(payload.generationConfig).not.toHaveProperty("responseFormat");
  });
});

describe("GeminiProvider — failure mapping (no internals leaked)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps 401 to AI_NOT_CONFIGURED", async () => {
    stubFetch(() => ({ ok: false, status: 401, text: async () => "bad key" }));
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });
  it("maps 400 (Gemini's wrong-key status) to AI_NOT_CONFIGURED", async () => {
    stubFetch(() => ({ ok: false, status: 400, text: async () => "API key not valid" }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect((err as AiError).code).toBe("AI_NOT_CONFIGURED");
    expect((err as AiError).message).toContain("HTTP 400");
  });
  it("attaches the sanitized upstream message as detail (never the key)", async () => {
    const leaked = `{"error":{"code":400,"message":"API key not valid. Key ${KEY} rejected.","status":"INVALID_ARGUMENT"}}`;
    stubFetch(() => ({ ok: false, status: 400, text: async () => leaked }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect((err as AiError).code).toBe("AI_NOT_CONFIGURED");
    expect((err as AiError).detail).toContain("API key not valid");
    expect((err as AiError).detail ?? "").not.toContain(KEY);
    expect((err as AiError).detail ?? "").not.toContain("AIza");
  });
  it("redacts AQ-format keys from upstream detail too", async () => {
    const aq = "AQ." + "Ab8RN6Ih".repeat(4);
    stubFetch(() => ({ ok: false, status: 403, text: async () => `{"error":{"message":"key ${aq} denied"}}` }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect((err as AiError).detail ?? "").not.toContain(aq);
    expect((err as AiError).detail ?? "").not.toContain("AQ.");
  });
  it("handles non-JSON upstream error bodies without crashing", async () => {
    stubFetch(() => ({ ok: false, status: 500, text: async () => "<html>proxy boom</html>" }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect((err as AiError).code).toBe("AI_UPSTREAM");
    expect((err as AiError).detail ?? "").toContain("proxy boom");
  });
  it("default model is a selectable free-tier model", () => {
    expect((GEMINI_MODELS as readonly string[]).includes(DEFAULT_AI_MODEL)).toBe(true);
  });
  it("maps 429 to AI_QUOTA with a friendly message", async () => {
    stubFetch(() => ({ ok: false, status: 429, text: async () => "quota" }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect((err as AiError).code).toBe("AI_QUOTA");
    expect((err as AiError).message).toContain("free-tier quota");
  });
  it("maps 404 to AI_UPSTREAM (model unavailable)", async () => {
    stubFetch(() => ({ ok: false, status: 404, text: async () => "no model" }));
    await expect(new GeminiProvider(KEY, "nope").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_UPSTREAM" });
  });
  it("maps network errors to AI_UPSTREAM", async () => {
    stubFetch(() => {
      throw new Error("network down");
    });
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_UPSTREAM" });
  });
  it("maps abort (timeout) to AI_UPSTREAM", async () => {
    stubFetch(() => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_UPSTREAM" });
  });
  it("maps invalid JSON output to AI_BAD_OUTPUT", async () => {
    stubFetch(() => okResponse({ candidates: [{ content: { parts: [{ text: "not json at all" }] } }] }));
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("maps empty output to AI_BAD_OUTPUT", async () => {
    stubFetch(() => okResponse({ candidates: [{ content: { parts: [] } }] }));
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("rejects oversized upstream payloads", async () => {
    stubFetch(() => okResponse({ candidates: [{ content: { parts: [{ text: "x".repeat(400_001) }] } }] }));
    await expect(new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT })).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
  });
  it("never includes the API key in error messages", async () => {
    stubFetch(() => ({ ok: false, status: 500, text: async () => `boom ${KEY}` }));
    const err = await new GeminiProvider(KEY, "gemini-2.5-flash").generate({ kind: "tool", targetKeyword: "x", lang: "en", context: CONTEXT }).catch((e: AiError) => e);
    expect(String((err as AiError).message)).not.toContain(KEY);
  });
});

describe("API key sanitization (paste artifacts)", () => {
  it("strips whitespace, newlines and invisible RTL/bidi marks", () => {
    const key = "AIza" + "E".repeat(35);
    expect(sanitizeApiKey(`  ${key}  `)).toBe(key);
    expect(sanitizeApiKey(`AIza${"E".repeat(10)}\n${"E".repeat(25)}`)).toBe(key);
    expect(sanitizeApiKey("\u200B\u200E" + key + "\u200F\uFEFF")).toBe(key);
    expect(sanitizeApiKey("\u202B" + key + "\u202C")).toBe(key);
    expect(sanitizeApiKey(key)).toBe(key);
    expect(sanitizeApiKey("")).toBe("");
    expect(sanitizeApiKey(null)).toBe("");
  });
  it("sanitized keys still pass setting validation", () => {
    const pasted = "  \nAIza" + "F".repeat(35) + "\u200B\n";
    expect(validateSetting("gemini_api_key", sanitizeApiKey(pasted))).toBe(true);
  });
});

describe("slug sanitization", () => {  it("produces DB-valid slugs", () => {
    expect(sanitizeSlug("Download Threads Reels on iPhone!", "fallback")).toBe("download-threads-reels-on-iphone");
    expect(sanitizeSlug("", "fallback here")).toBe("fallback-here");
    expect(sanitizeSlug("###", "ok")).toMatch(/^[a-z0-9-]+$/);
    expect(sanitizeSlug("a".repeat(200), "x")).toBe("a".repeat(80));
  });
  it("always returns a DB-valid slug, even for degenerate input", async () => {
    const { isValidSlug } = await import("../src/server/content/types");
    for (const [input, fb] of [["", ""], ["###", "!!!"], ["--", "--"], ["   ", "   "]] as const) {
      expect(isValidSlug(sanitizeSlug(input, fb))).toBe(true);
    }
    // Deterministic fallback for fully degenerate input.
    expect(sanitizeSlug("", "")).toBe(sanitizeSlug("", ""));
  });
});
