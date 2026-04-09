import { createServiceRoleClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/ai/embeddings";

export type WorkshopChunkHit = {
  id: number;
  source_path: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

/**
 * Vector search over indexed `Car_Libraries` HTML export for one library key.
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and populated `car_library_chunks`.
 */
export async function searchWorkshopLibraryChunks(
  libraryKey: string,
  query: string,
  matchCount = 12,
): Promise<WorkshopChunkHit[]> {
  const key = libraryKey.trim();
  if (!key) return [];

  const embedding = await embedQuery(query);
  const query_embedding = `[${embedding.join(",")}]`;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("match_car_library_chunks", {
    query_embedding,
    match_library_key: key,
    match_count: matchCount,
  });

  if (error) {
    console.error("match_car_library_chunks", error);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: number;
    source_path: string;
    chunk_index: number;
    content: string;
    similarity: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    source_path: r.source_path,
    chunk_index: r.chunk_index,
    content: r.content,
    similarity: r.similarity,
  }));
}
