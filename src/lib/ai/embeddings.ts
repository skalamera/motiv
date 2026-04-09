import { gateway } from "@ai-sdk/gateway";
import { google } from "@ai-sdk/google";
import { embed } from "ai";

/** Must match `car_library_chunks.embedding` column (pgvector). */
export const WORKSHOP_EMBEDDING_DIMENSIONS = 768;

/** Forwarded to Google embedding models (direct or via AI Gateway). */
export const workshopEmbeddingProviderOptions = {
  google: { outputDimensionality: WORKSHOP_EMBEDDING_DIMENSIONS },
} as const;

/**
 * Prefer Google AI Studio key; otherwise Vercel AI Gateway (same env as chat).
 */
export function getWorkshopEmbeddingModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return google.textEmbeddingModel("gemini-embedding-001");
  }
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return gateway.textEmbeddingModel("google/gemini-embedding-001");
  }
  throw new Error(
    "Set GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY for workshop library embeddings.",
  );
}

/**
 * Query embedding for workshop library search.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) {
    throw new Error("embedQuery: empty text");
  }

  const { embedding } = await embed({
    model: getWorkshopEmbeddingModel(),
    value: trimmed,
    providerOptions: workshopEmbeddingProviderOptions,
  });

  if (embedding.length !== WORKSHOP_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding length ${embedding.length}; expected ${WORKSHOP_EMBEDDING_DIMENSIONS}`,
    );
  }

  return [...embedding];
}
