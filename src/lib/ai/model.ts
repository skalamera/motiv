import { google } from "@ai-sdk/google";

/**
 * Prefer Vercel AI Gateway (AI_GATEWAY_API_KEY + `google/...` id).
 * Fallback: direct Google provider (GOOGLE_GENERATIVE_AI_API_KEY).
 */
export function getMotivModel() {
  if (process.env.AI_GATEWAY_API_KEY) {
    return "google/gemini-2.5-flash" as const;
  }
  return google("gemini-2.5-flash");
}
