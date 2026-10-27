/**
 * Shared AI model registry (dependency-free so both the Worker and the admin
 * UI import it — the client bundle must never pull in server AI code).
 * All listed models are available on Gemini's free tier.
 */

export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash-lite",
] as const;

// Google limits the 2.5 models to accounts that used them in the past and
// recommends the 3.x Flash models for new projects — so the newest stable
// Flash model is the default. Admins can switch any time from the UI.
export const DEFAULT_AI_MODEL = "gemini-3.8-flash";
