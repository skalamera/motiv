/**
 * Index a local Car_Libraries/<libraryKey>/ **recursive** HTML tree into Supabase pgvector.
 * Picks up flat `pages/*.html` exports and deep workshop trees (e.g. Repair…/…/index.html).
 *
 * Prerequisites:
 * - Run SQL migration `20250409120000_car_library_rag.sql`
 * - Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and either
 *   GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY (gemini-embedding-001)
 *
 * Usage:
 *   npm run index-car-library -- "2018 Porsche 911 Carrera S"
 *   npm run index-car-library -- "2018 Porsche 911 Carrera S" --max-files 400
 *   npm run index-car-library -- "2018 Porsche 911 Carrera S" --insert-batch 15
 *   npm run index-car-library -- "2018 Porsche 911 Carrera S" --root /path/to/Car_Libraries
 *
 * If inserts fail with "statement timeout", use a smaller --insert-batch (e.g. 10–25).
 * Large re-indexes: existing rows are deleted in waves (not one huge DELETE) to avoid timeout.
 *
 * Large libraries: prefer GOOGLE_GENERATIVE_AI_API_KEY (Google AI Studio). Vercel AI Gateway
 * free tier often rate-limits bulk embedding; use --embed-delay-ms and smaller --embed-batch if needed.
 *
 * Then set the same string as "Workshop library key" on the car in Settings.
 */

import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import {
  getWorkshopEmbeddingModel,
  workshopEmbeddingProviderOptions,
} from "../src/lib/ai/embeddings";
import * as cheerio from "cheerio";
import { access, readdir, readFile } from "fs/promises";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv();

/** Keep in sync with `src/lib/ai/embeddings.ts` and pgvector column. */
const EMBED_DIM = 768;

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
const DEFAULT_EMBED_BATCH_GOOGLE = 48;
/** Gateway free tier is strict; smaller batches + delay reduce 429s (Google direct is still best). */
const DEFAULT_EMBED_BATCH_GATEWAY = 12;
const DEFAULT_EMBED_DELAY_MS_GATEWAY = 450;
/** Supabase often times out on huge multi-row vector inserts; keep this small (10–40). */
const DEFAULT_INSERT_BATCH = 25;
const INSERT_BATCH_MIN = 5;
/** Pause between DB insert sub-batches to reduce pool pressure. */
const INSERT_GAP_MS = 100;
const INSERT_RETRY_MAX = 6;
const INSERT_RETRY_BASE_MS = 2500;
/** One big DELETE for a large library hits statement timeout; delete by id in waves. */
const DEFAULT_DELETE_BATCH = 300;

const EMBED_RETRY_MAX = 14;
const EMBED_RETRY_BASE_MS = 4000;
const EMBED_RETRY_MAX_MS = 120_000;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isRetryableEmbedError(e: unknown): boolean {
  if (GatewayRateLimitError.isInstance(e)) return true;
  if (typeof e === "object" && e !== null) {
    const rec = e as Record<string, unknown>;
    if (rec.statusCode === 429) return true;
    const cause = rec.cause;
    if (cause) return isRetryableEmbedError(cause);
  }
  return false;
}

async function embedManyWithRetry(
  args: Parameters<typeof embedMany>[0],
  batchLabel: string,
): Promise<Awaited<ReturnType<typeof embedMany>>> {
  for (let attempt = 1; attempt <= EMBED_RETRY_MAX; attempt++) {
    try {
      return await embedMany(args);
    } catch (e) {
      const retry = isRetryableEmbedError(e) && attempt < EMBED_RETRY_MAX;
      if (!retry) throw e;
      const backoff = Math.min(
        EMBED_RETRY_MAX_MS,
        EMBED_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 1500,
      );
      console.warn(
        `  ${batchLabel}: rate limited (${attempt}/${EMBED_RETRY_MAX}), waiting ${Math.round(backoff / 1000)}s…`,
      );
      await sleep(backoff);
    }
  }
  throw new Error("embedManyWithRetry: exhausted retries");
}

/** All `.html` files under `libraryRoot`, paths relative to that folder (posix `/`). */
async function collectHtmlRelativePaths(libraryRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(relDir: string): Promise<void> {
    const absDir = path.join(libraryRoot, relDir);
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(rel);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".html")) {
        results.push(rel.split(path.sep).join("/"));
      }
    }
  }

  await walk("");
  results.sort((a, b) => a.localeCompare(b));
  return results;
}

function chunkText(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 80) return [];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    out.push(t.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
    if (i >= t.length) break;
  }
  return out;
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe").remove();
  const body = $("body");
  const raw = body.length ? body.text() : $.root().text();
  return raw.replace(/\s+/g, " ").trim();
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let root = path.join(process.cwd(), "Car_Libraries");
  let maxFiles: number | null = null;
  let embedBatch: number | null = null;
  let embedDelayMs: number | null = null;
  let insertBatch: number | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) {
      root = path.resolve(argv[++i]);
    } else if (a === "--max-files" && argv[i + 1]) {
      maxFiles = parseInt(argv[++i], 10);
    } else if (a === "--embed-batch" && argv[i + 1]) {
      embedBatch = parseInt(argv[++i], 10);
    } else if (a === "--embed-delay-ms" && argv[i + 1]) {
      embedDelayMs = parseInt(argv[++i], 10);
    } else if (a === "--insert-batch" && argv[i + 1]) {
      insertBatch = parseInt(argv[++i], 10);
    } else if (!a.startsWith("-")) {
      positional.push(a);
    }
  }
  const libraryKey = positional[0]?.trim();
  return { libraryKey, root, maxFiles, embedBatch, embedDelayMs, insertBatch };
}

type RowInsert = {
  library_key: string;
  source_path: string;
  chunk_index: number;
  content: string;
  embedding: string;
};

function isInsertTimeoutMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("canceling statement") ||
    m.includes("statement timeout") ||
    m.includes("query_canceled") ||
    m.includes("57014")
  );
}

async function deleteChunksForLibrary(
  supabase: SupabaseClient,
  libraryKey: string,
  deleteBatch: number,
): Promise<void> {
  const batch = Math.max(50, deleteBatch);
  let total = 0;
  let waves = 0;

  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from("car_library_chunks")
      .select("id")
      .eq("library_key", libraryKey)
      .limit(batch);

    if (selErr) {
      console.error("Delete (read ids) failed:", selErr.message);
      process.exit(1);
    }
    if (!rows?.length) break;

    const ids = rows.map((r) => r.id);
    for (let attempt = 1; attempt <= INSERT_RETRY_MAX; attempt++) {
      const { error: delErr } = await supabase
        .from("car_library_chunks")
        .delete()
        .in("id", ids as never);
      if (!delErr) break;

      const retry =
        attempt < INSERT_RETRY_MAX && isInsertTimeoutMessage(delErr.message);
      if (retry) {
        const wait = Math.min(
          45_000,
          INSERT_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 800,
        );
        console.warn(
          `  delete batch: timeout (${delErr.message.slice(0, 80)}…) — retry ${attempt}/${INSERT_RETRY_MAX} in ${Math.round(wait / 1000)}s`,
        );
        await sleep(wait);
        continue;
      }
      console.error("Delete existing chunks failed:", delErr.message);
      process.exit(1);
    }

    total += ids.length;
    waves++;
    if (waves % 15 === 0 || ids.length < batch) {
      console.log(`  …cleared ${total} old chunks for "${libraryKey}"`);
    }
    await sleep(INSERT_GAP_MS);
  }

  if (total > 0) {
    console.log(`Cleared ${total} existing chunk row(s) for "${libraryKey}".`);
  } else {
    console.log(`No existing rows for "${libraryKey}" (fresh index).`);
  }
}

async function insertChunkRows(
  supabase: SupabaseClient,
  rows: RowInsert[],
  label: string,
  insertBatchSize: number,
): Promise<void> {
  const batchSize = Math.max(INSERT_BATCH_MIN, insertBatchSize);
  for (let k = 0; k < rows.length; k += batchSize) {
    const batch = rows.slice(k, k + batchSize);
    for (let attempt = 1; attempt <= INSERT_RETRY_MAX; attempt++) {
      const { error: insErr } = await supabase
        .from("car_library_chunks")
        .insert(batch as never);
      if (!insErr) break;

      const retry =
        attempt < INSERT_RETRY_MAX && isInsertTimeoutMessage(insErr.message);
      if (retry) {
        const wait = Math.min(
          45_000,
          INSERT_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 800,
        );
        console.warn(
          `  ${label}: insert failed (${insErr.message.slice(0, 120)}…) — retry ${attempt}/${INSERT_RETRY_MAX} in ${Math.round(wait / 1000)}s`,
        );
        await sleep(wait);
        continue;
      }
      console.error("Insert failed:", insErr.message);
      process.exit(1);
    }
    await sleep(INSERT_GAP_MS);
  }
}

async function main() {
  const {
    libraryKey,
    root,
    maxFiles,
    embedBatch: embedBatchArg,
    embedDelayMs: embedDelayArg,
    insertBatch: insertBatchArg,
  } = parseArgs();
  if (!libraryKey) {
    console.error(
      'Usage: npm run index-car-library -- "<folder name>" [--root path] [--max-files N] [--embed-batch N] [--embed-delay-ms N] [--insert-batch N]',
    );
    process.exit(1);
  }

  const insertBatchSize =
    insertBatchArg != null &&
    Number.isFinite(insertBatchArg) &&
    insertBatchArg >= INSERT_BATCH_MIN
      ? Math.floor(insertBatchArg)
      : DEFAULT_INSERT_BATCH;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const hasGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
  if (!hasGoogle && !hasGateway) {
    console.error(
      "Missing GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY (required for embeddings)",
    );
    process.exit(1);
  }

  const usingGatewayOnly = !hasGoogle && hasGateway;
  const embedBatch =
    embedBatchArg != null && Number.isFinite(embedBatchArg) && embedBatchArg > 0
      ? embedBatchArg
      : usingGatewayOnly
        ? DEFAULT_EMBED_BATCH_GATEWAY
        : DEFAULT_EMBED_BATCH_GOOGLE;
  const embedDelayMs =
    embedDelayArg != null && Number.isFinite(embedDelayArg) && embedDelayArg >= 0
      ? embedDelayArg
      : usingGatewayOnly
        ? DEFAULT_EMBED_DELAY_MS_GATEWAY
        : 0;

  if (usingGatewayOnly) {
    console.warn(
      "Embedding via Vercel AI Gateway: free tier often hits rate limits on large indexes.\n" +
        "  Add GOOGLE_GENERATIVE_AI_API_KEY (https://aistudio.google.com/apikey) for reliable bulk runs, or tune --embed-batch / --embed-delay-ms.\n" +
        `  Using batch size ${embedBatch}, ${embedDelayMs}ms pause between batches.`,
    );
  }

  const libraryRoot = path.join(root, libraryKey);
  const supabase = createClient(url, key);

  console.log("Library:", libraryKey);
  console.log("Library root:", libraryRoot);

  try {
    await access(libraryRoot);
  } catch {
    console.error("Library folder not found:", libraryRoot);
    process.exit(1);
  }

  let names = await collectHtmlRelativePaths(libraryRoot);

  if (maxFiles != null && Number.isFinite(maxFiles)) {
    names = names.slice(0, maxFiles);
  }

  console.log(`Found ${names.length} HTML files under tree (max-files=${maxFiles ?? "all"})`);
  console.log(
    `DB insert sub-batch size: ${insertBatchSize} rows (override with --insert-batch; lower if you see statement timeout)`,
  );
  console.log(
    `Deleting any existing rows for this library in batches of ${DEFAULT_DELETE_BATCH} (avoids statement timeout on large libraries).`,
  );

  await deleteChunksForLibrary(supabase, libraryKey, DEFAULT_DELETE_BATCH);

  type Pending = { source_path: string; chunk_index: number; content: string };
  const pending: Pending[] = [];

  let fileN = 0;
  for (const relPath of names) {
    fileN++;
    if (fileN % 500 === 0) {
      console.log(`  …parsed ${fileN}/${names.length} files, ${pending.length} chunks so far`);
    }
    const fp = path.join(libraryRoot, relPath);
    const html = await readFile(fp, "utf8");
    const text = htmlToText(html);
    const parts = chunkText(text);
    parts.forEach((content, chunk_index) => {
      pending.push({ source_path: relPath, chunk_index, content });
    });
  }

  console.log(`Total chunks to embed: ${pending.length}`);
  if (pending.length === 0) {
    console.log("Nothing to index.");
    return;
  }

  const model = getWorkshopEmbeddingModel();
  let batchNum = 0;
  const batchDurationsMs: number[] = [];
  const rollingWindow = 12;

  for (let i = 0; i < pending.length; i += embedBatch) {
    batchNum++;
    const batchStarted = Date.now();
    const slice = pending.slice(i, i + embedBatch);
    const { embeddings } = await embedManyWithRetry(
      {
        model,
        values: slice.map((s) => s.content),
        providerOptions: workshopEmbeddingProviderOptions,
      },
      `batch ${batchNum}`,
    );

    const rows: RowInsert[] = slice.map((s, j) => {
      const emb = embeddings[j];
      if (!emb || emb.length !== EMBED_DIM) {
        throw new Error(`Bad embedding at batch offset ${i + j}`);
      }
      return {
        library_key: libraryKey,
        source_path: s.source_path,
        chunk_index: s.chunk_index,
        content: s.content,
        embedding: `[${[...emb].join(",")}]`,
      };
    });

    await insertChunkRows(
      supabase,
      rows,
      `embed batch ${batchNum}`,
      insertBatchSize,
    );

    const done = Math.min(i + embedBatch, pending.length);
    const total = pending.length;
    const pct = ((100 * done) / total).toFixed(1);
    batchDurationsMs.push(Date.now() - batchStarted);
    if (batchDurationsMs.length > rollingWindow) batchDurationsMs.shift();

    let etaHint = "";
    if (batchDurationsMs.length >= 2 && done < total) {
      const avgMs =
        batchDurationsMs.reduce((a, b) => a + b, 0) / batchDurationsMs.length;
      const batchesLeft = Math.ceil((total - done) / embedBatch);
      const etaSec = Math.round(
        (batchesLeft * avgMs + batchesLeft * embedDelayMs) / 1000,
      );
      if (Number.isFinite(etaSec) && etaSec > 0) {
        const m = Math.floor(etaSec / 60);
        const s = etaSec % 60;
        etaHint = m > 0 ? ` ~${m}m ${s}s left` : ` ~${s}s left`;
      }
    }

    console.log(`  embedded ${done}/${total} (${pct}%)${etaHint}`);
    if (embedDelayMs > 0 && i + embedBatch < pending.length) {
      await sleep(embedDelayMs);
    }
  }

  console.log("Done. Set this exact string as Workshop library key on the car in Settings.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
