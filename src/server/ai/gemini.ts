/**
 * Gemini provider — free Google AI Studio tier (no card required).
 *
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Auth: `x-goog-api-key` header (the key never appears in a URL, log or client payload).
 * Output: constrained JSON via generationConfig.responseFormat (structured output).
 *
 * Hard guarantees enforced in code:
 * - timeout + size caps, single retry on network errors only
 * - upstream status bodies and keys are never surfaced to callers
 * - every field is normalized to the site's own validation bounds, and guide
 *   HTML goes through the shared sanitizer before it can reach a response
 */

import type { AiDraft, AiFaq, AiProvider, AiRequest, AiToolDraft, AiGuideDraft, AiError } from "./types";
import { AiError as AiErrorClass, DEFAULT_AI_MODEL, sanitizeSlug } from "./types";
import { sanitizeGuideHtml } from "../content/types";

const API_BASE = "https://generativelanguage.googleapis.com";
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS_GUIDE = 4096;
const MAX_OUTPUT_TOKENS_TOOL = 3072;
const MAX_RESPONSE_CHARS = 400_000;

const SYSTEM_PROMPT = `You are a senior SEO content strategist writing for "Threads Video Downloader", an independent third-party web tool that downloads publicly accessible Threads videos, photos and carousel media.

Facts you must respect (never contradict them):
- Only public content is supported; private accounts are never supported.
- No Threads login, password or cookies are ever required.
- The site is independent and NOT affiliated with or endorsed by Threads or Meta.
- The tool adds no watermark and does not remove watermarks.
- Users are responsible for having permission to use the media they download.

Hard honesty rules:
- NEVER invent statistics, user counts, download counts, ratings, reviews or testimonials.
- Never claim unlimited downloads, guaranteed speeds or guaranteed video qualities.
- Never mention that content was written by an AI.

Uniqueness rules (the caller provides existing titles and FAQ questions):
- The new title, H1 and meta description must be substantially different from every existing title provided. No rewording, no light rephrasing.
- FAQ questions must be new — not variations of existing ones.
- Include at least one concrete differentiator: a step-by-step workflow, a device-specific detail (iOS/Android/desktop), or an edge case (expired link, mixed carousel, private post, link without media).

Keyword rules:
- Use the target keyword naturally, once in the title (near the start), once in the H1, once in the meta description. Total keyword density under 1.5%. No keyword stuffing.

Structure rules by kind:
- "tool" landing page: badge (max 40 chars, uppercase, short label), intro 400-700 chars explaining this specific use case and how the tool solves it, 4-5 FAQs whose answers are 60-140 chars, concrete and honest.
- "guide" article: body 1800-2800 chars of clean HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, organized in 3-5 <h2> sections, with practical numbered or bulleted steps. Only link internally with href paths from the provided pool (tool pages use "/slug", guides use "/blog/slug"). End with a short recap paragraph.

Language rules:
- Write entirely in the requested language. For "ar" use Modern Standard Arabic. For "fr" use French. Do not mix languages except unavoidable brand names.

Output rules:
- Reply with strict JSON only, matching the caller's schema. No markdown, no code fences, no commentary, no trailing text.`;

function userPrompt(req: AiRequest, schemaHint: string): string {
  const langLabel = req.lang === "ar" ? "Arabic (Modern Standard)" : req.lang === "fr" ? "French" : "English";
  const lines = [
    `Kind: ${req.kind}`,
    `Language: ${langLabel}`,
    `Target keyword: ${req.targetKeyword}`,
    "",
    "Existing page titles on this site (your title/H1/description MUST be substantially different from all of these):",
    req.context.existingTitles.length > 0 ? req.context.existingTitles.map((t) => `- ${t}`).join("\n") : "- (none yet)",
    "",
    "Existing FAQ questions (your questions MUST be new, not variations):",
    req.context.existingFaqQuestions.length > 0 ? req.context.existingFaqQuestions.map((q) => `- ${q}`).join("\n") : "- (none yet)",
  ];
  if (req.kind === "guide") {
    lines.push(
      "",
      "You may ONLY use these internal link paths in the body (pick the relevant ones):",
      req.context.linkPaths.length > 0 ? req.context.linkPaths.map((p) => `- ${p}`).join("\n") : "- (none available yet)",
    );
  } else {
    lines.push(
      "",
      "You may ONLY use these page slugs in related_slugs:",
      req.context.allowedSlugs.length > 0 ? req.context.allowedSlugs.map((s) => `- ${s}`).join("\n") : "- (none available yet)",
    );
  }
  lines.push("", `Return exactly this JSON shape: ${schemaHint}`);
  return lines.join("\n");
}

function jsonSchema(kind: AiRequest["kind"]): Record<string, unknown> {
  const common = {
    slug: {
      type: "string",
      description: "3-60 chars, lowercase latin (or Arabic) letters/digits/hyphens, no reserved words like sitemap or admin",
    },
    title: { type: "string", description: "40-65 chars, target keyword near the start, unique" },
    description: { type: "string", description: "140-158 chars meta description containing the keyword once" },
    h1: { type: "string", description: "10-80 chars, natural phrasing containing the keyword" },
    faqs: {
      type: "array",
      description: "4-5 unique FAQs",
      items: {
        type: "object",
        properties: {
          q: { type: "string", description: "question, min 10 chars" },
          a: { type: "string", description: "honest concrete answer, 60-140 chars" },
        },
        required: ["q", "a"],
      },
    },
    related_slugs: {
      type: "array",
      description: "up to 4 slugs chosen from the provided pool, most relevant first",
      items: { type: "string" },
    },
  };
  const extra =
    kind === "tool"
      ? {
          badge: { type: "string", description: "max 40 chars, uppercase short label like HD VIDEO" },
          intro: { type: "string", description: "400-700 chars intro for this specific use case" },
        }
      : {
          body: {
            type: "string",
            description: "1800-2800 chars HTML with 3-5 h2 sections, only allowed tags, internal links from the pool",
          },
        };
  return {
    type: "object",
    properties: { ...common, ...extra },
    required: kind === "tool"
      ? ["slug", "badge", "title", "description", "h1", "intro", "faqs", "related_slugs"]
      : ["slug", "title", "description", "h1", "body", "faqs", "related_slugs"],
  };
}

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function clampFaqs(v: unknown, max: number): AiFaq[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => {
      const r = (f || {}) as Record<string, unknown>;
      return { q: asString(r["q"], 200), a: asString(r["a"], 600) };
    })
    .filter((f) => f.q.length >= 10 && f.a.length >= 30)
    .slice(0, max);
}

/**
 * Pull a short, safe diagnostic out of an upstream error response.
 * Google's error bodies carry { error: { message } } — never credentials —
 * but we redact key-shaped strings anyway and cap the length, because this
 * text is shown to the admin for diagnosis.
 */
export function extractUpstreamDetail(raw: string, maxLen = 300): string {
  let text = String(raw || "").slice(0, 4096);
  try {
    const parsed: unknown = JSON.parse(text);
    const msg = (parsed as { error?: { message?: unknown } })?.error?.message;
    if (typeof msg === "string" && msg.trim()) text = msg;
  } catch {
    /* not JSON — use the raw text as-is */
  }
  return text
    .replace(/AIza[0-9A-Za-z_\-.]+/g, "[redacted-key]")
    .replace(/AQ\.[0-9A-Za-z_\-.]+/g, "[redacted-key]")
    .trim()
    .slice(0, maxLen);
}

function mapStatus(status: number): AiError {  // Gemini reports a wrong API key as 400 ("API key not valid") as well as
  // 401/403 — and it gates some models per account with 403 too. The HTTP
  // status is included (no secrets) so the admin can tell key problems
  // apart from model-availability problems.
  if (status === 400 || status === 401 || status === 403) {
    return new AiErrorClass(
      "AI_NOT_CONFIGURED",
      `The AI provider refused the request (HTTP ${status}). Check: (1) the key is complete, ` +
        `(2) the key has no website/IP restrictions in AI Studio — server calls come from Cloudflare, ` +
        `(3) try another model below; some models are unavailable for new projects.`,
    );
  }
  if (status === 429) {
    return new AiErrorClass("AI_QUOTA", "Gemini free-tier quota or rate limit reached. Try again shortly or tomorrow (free tier is about 1,500 requests/day).");
  }
  if (status === 404) {
    return new AiErrorClass("AI_UPSTREAM", "The selected Gemini model is unavailable. Choose another model in the AI generator settings.");
  }
  return new AiErrorClass("AI_UPSTREAM", "The AI provider is temporarily unavailable. Please try again.");
}

export class GeminiProvider implements AiProvider {
  name = "gemini";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generate(req: AiRequest): Promise<AiDraft> {
    const model = (this.model || DEFAULT_AI_MODEL).trim();
    const schema = jsonSchema(req.kind);
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt(req, JSON.stringify(schema["properties"])) }] }],
      generationConfig: {
        // Classic REST structured-output fields. The newer responseFormat.text
        // object is rejected by v1beta :generateContent ("Invalid value at
        // generation_config.response_format.text.mime_type") — verified live.
        response_mime_type: "application/json",
        response_schema: schema,
        maxOutputTokens: req.kind === "guide" ? MAX_OUTPUT_TOKENS_GUIDE : MAX_OUTPUT_TOKENS_TOOL,
      },
    };

    const ctrl = new AbortController();    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response | null = null;
    try {
      res = await fetch(`${API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch {
      throw new AiErrorClass("AI_UPSTREAM", "Could not reach the AI provider (timeout or network error). Please try again.");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = "";
      try {
        detail = extractUpstreamDetail(await res.text());
      } catch {
        detail = "";
      }
      const err = mapStatus(res.status);
      if (detail) err.detail = detail;
      throw err;
    }

    let text = "";
    try {
      text = await res.text();
    } catch {
      throw new AiErrorClass("AI_UPSTREAM", "The AI provider returned an unreadable response.");
    }
    if (text.length > MAX_RESPONSE_CHARS) {
      throw new AiErrorClass("AI_BAD_OUTPUT", "The AI response was too large to process.");
    }

    const parsed = this.parseResponse(text);
    const allowed = new Set(req.context.allowedSlugs);
    const related = Array.isArray(parsed["related_slugs"])
      ? (parsed["related_slugs"] as unknown[])
          .filter((s): s is string => typeof s === "string" && allowed.has(s))
          .slice(0, 4)
      : [];

    const faqs = clampFaqs(parsed["faqs"], 5);
    const title = asString(parsed["title"], 160);
    const description = asString(parsed["description"], 320);
    const h1 = asString(parsed["h1"], 140);
    const slug = sanitizeSlug(asString(parsed["slug"], 120), req.targetKeyword);

    if (req.kind === "tool") {
      const intro = asString(parsed["intro"], 2000);
      const draft: AiToolDraft = {
        kind: "tool",
        slug,
        badge: asString(parsed["badge"], 40).toUpperCase(),
        title,
        description,
        h1,
        intro,
        faqs,
        related_slugs: related,
      };
      if (!title || !description || !h1 || !intro || faqs.length < 3) {
        throw new AiErrorClass("AI_BAD_OUTPUT", "The AI draft was incomplete. Try regenerating.");
      }
      return draft;
    }

    const body = sanitizeGuideHtml(asString(parsed["body"], 60_000));
    const draft: AiGuideDraft = { kind: "guide", slug, title, description, h1, body, faqs, related_slugs: related };
    if (!title || !description || !h1 || body.trim().length < 400 || faqs.length < 3) {
      throw new AiErrorClass("AI_BAD_OUTPUT", "The AI draft was incomplete. Try regenerating.");
    }
    return draft;
  }

  /** Concatenate all text parts, strip code fences, parse JSON strictly. */
  private parseResponse(text: string): Record<string, unknown> {
    let outer: unknown;
    try {
      outer = JSON.parse(text);
    } catch {
      throw new AiErrorClass("AI_UPSTREAM", "The AI provider returned a malformed response.");
    }
    const candidates = (outer as { candidates?: unknown }).candidates;
    const parts = Array.isArray(candidates)
      ? ((candidates[0] as { content?: { parts?: unknown } })?.content?.parts ?? [])
      : [];
    const raw = (Array.isArray(parts) ? parts : [])
      .map((p) => ((p as { text?: unknown }).text as string) ?? "")
      .join("")
      .trim();
    if (!raw) throw new AiErrorClass("AI_BAD_OUTPUT", "The AI returned no content.");
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch {
      throw new AiErrorClass("AI_BAD_OUTPUT", "The AI output was not valid JSON. Try regenerating.");
    }
    return (json && typeof json === "object" ? (json as Record<string, unknown>) : {}) as Record<string, unknown>;
  }
}
