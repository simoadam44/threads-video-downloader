/**
 * AI provider factory + settings-backed config (mirrors resolvers/index.ts).
 * The admin UI and worker routes only depend on the AiProvider interface.
 */

import type { AiProvider } from "./types";
import { AiError, DEFAULT_AI_MODEL } from "./types";
import { GeminiProvider } from "./gemini";

export type { AiDraft, AiGuideDraft, AiToolDraft, AiFaq, AiKind, AiLang, AiProvider, AiRequest } from "./types";
export { AiError, DEFAULT_AI_MODEL, GEMINI_MODELS, maskApiKey, sanitizeSlug } from "./types";

export interface AiEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_PROVIDER?: string;
}

export interface AiConfig {
  apiKey: string;
  model: string;
}

/** Env secrets win over DB settings; the DB value keeps the admin UI key-less. */
export function aiConfig(env: AiEnv, settings: Record<string, string>): AiConfig {
  const envKey = (env.GEMINI_API_KEY || "").trim();
  const envModel = (env.GEMINI_MODEL || "").trim();
  if (envKey || envModel) {
    return { apiKey: envKey, model: envModel || DEFAULT_AI_MODEL };
  }
  const dbKey = (settings["gemini_api_key"] || "").trim();
  const dbModel = (settings["gemini_model"] || "").trim();
  return { apiKey: dbKey, model: dbModel || DEFAULT_AI_MODEL };
}

export function getAiProvider(cfg: AiConfig): AiProvider {
  if (!cfg.apiKey) {
    throw new AiError("AI_NOT_CONFIGURED", "AI generator is not configured. Add a Gemini API key in the engine settings.");
  }
  return new GeminiProvider(cfg.apiKey, cfg.model);
}
