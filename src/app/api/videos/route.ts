import { createClient } from "@/lib/supabase/server";

type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type VideoResult = {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

type KeywordVideos = {
  keyword: string;
  videos: VideoResult[];
};

type KeywordFailure = {
  keyword: string;
  error: string;
};

const MAX_KEYWORDS = 6;
const VIDEOS_PER_KEYWORD = 4;
const YOUTUBE_BATCH_SIZE = 12;

type KeywordCursor = {
  query: string;
  pageToken?: string;
  done?: boolean;
};

type CursorMap = Record<string, KeywordCursor>;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickThumbnail(item: YoutubeSearchItem): string {
  return (
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    item.snippet?.thumbnails?.default?.url ||
    ""
  );
}

function parseApiErrorDetail(raw: string): string {
  let detail = raw.slice(0, 240);
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    const reason = parsed.error?.errors?.[0]?.reason;
    const message = parsed.error?.message;
    detail = [reason, message].filter(Boolean).join(" - ") || detail;
  } catch {
    // keep raw excerpt fallback
  }
  return detail;
}

function parseCursorFromUrl(url: URL): CursorMap {
  const raw = url.searchParams.get("cursor");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CursorMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function makeInitialQuery(keyword: string): string {
  const intents = shuffle([
    "upgrades",
    "mods",
    "build",
    "tune",
    "exhaust",
    "review",
    "project car",
  ]);
  return `${keyword} ${intents[0]}`;
}

async function searchVideosPage(
  query: string,
  apiKey: string,
  pageToken?: string,
  channelId?: string,
  order: "relevance" | "date" = "relevance"
): Promise<{ videos: VideoResult[]; nextPageToken?: string }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", String(YOUTUBE_BATCH_SIZE));
  url.searchParams.set("order", order);
  url.searchParams.set("safeSearch", "moderate");
  if (query) url.searchParams.set("q", query);
  if (channelId) url.searchParams.set("channelId", channelId);
  url.searchParams.set("key", apiKey);
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const txt = await res.text();
    const detail = parseApiErrorDetail(txt);
    throw new Error(`YouTube API ${res.status}: ${detail}`);
  }

  const json = (await res.json()) as {
    items?: YoutubeSearchItem[];
    nextPageToken?: string;
  };
  const items = json.items ?? [];

  const mapped = items
    .map((it) => {
      const videoId = it.id?.videoId?.trim();
      if (!videoId) return null;
      return {
        id: videoId,
        title: it.snippet?.title?.trim() ?? "Untitled",
        channelTitle: it.snippet?.channelTitle?.trim() ?? "YouTube",
        publishedAt: it.snippet?.publishedAt ?? "",
        thumbnail: pickThumbnail(it),
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((v): v is VideoResult => Boolean(v));
    
  const videos = order === "date" ? mapped.slice(0, VIDEOS_PER_KEYWORD) : shuffle(mapped).slice(0, VIDEOS_PER_KEYWORD);

  return { videos, nextPageToken: json.nextPageToken };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({
      configured: false,
      groups: [] as KeywordVideos[],
      message: "Set YOUTUBE_API_KEY to load personalized YouTube videos.",
    });
  }

  const { data: cars, error } = await supabase
    .from("cars")
    .select("year, make, model")
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json(
      { configured: true, groups: [] as KeywordVideos[], error: error.message },
      { status: 500 },
    );
  }

  const keywords = [...new Set(
    (cars ?? [])
      .map((c) => [c.make, c.model].filter(Boolean).join(" ").trim())
      .filter(Boolean),
  )].slice(0, MAX_KEYWORDS);

  const hasPorsche = (cars ?? []).some(c => c.make?.toLowerCase() === "porsche");

  if (keywords.length === 0) {
    return Response.json({
      configured: true,
      groups: [] as KeywordVideos[],
      emptyGarage: true,
    });
  }

  const url = new URL(req.url);
  const incomingCursor = parseCursorFromUrl(url);
  const nextCursor: CursorMap = { ...incomingCursor };

  const failures: KeywordFailure[] = [];
  const groups: KeywordVideos[] = [];
  const pcaGroups: KeywordVideos[] = [];

  // Add PCA channel videos if they have a Porsche
  if (hasPorsche) {
    const pcaKeyword = "Porsche Club of America";
    const current = nextCursor[pcaKeyword];
    if (!current?.done) {
      try {
        const { videos, nextPageToken } = await searchVideosPage(
          "",
          apiKey,
          current?.pageToken,
          "UCdBSaHWRHMQTVALwa7gs7Fg", // PCA Channel ID
          "date" // sort by most recent
        );
        if (videos.length > 0) {
          pcaGroups.push({ keyword: pcaKeyword, videos });
        }
        nextCursor[pcaKeyword] = {
          query: "",
          pageToken: nextPageToken,
          done: !nextPageToken,
        };
      } catch (e) {
        const err = e instanceof Error ? e.message : "Unknown YouTube API error";
        console.error(`YouTube lookup failed for PCA:`, err);
        failures.push({
          keyword: pcaKeyword,
          error: err,
        });
        nextCursor[pcaKeyword] = {
          query: "",
          done: true,
        };
      }
    }
  }

  for (const keyword of keywords) {
    const current = nextCursor[keyword];
    if (current?.done) continue;
    const query = current?.query ?? makeInitialQuery(keyword);
    try {
      const { videos, nextPageToken } = await searchVideosPage(
        query,
        apiKey,
        current?.pageToken,
      );
      if (videos.length > 0) {
        groups.push({ keyword, videos });
      }
      nextCursor[keyword] = {
        query,
        pageToken: nextPageToken,
        done: !nextPageToken,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : "Unknown YouTube API error";
      console.error(`YouTube lookup failed for ${keyword}:`, err);
      failures.push({
        keyword,
        error: err,
      });
      nextCursor[keyword] = {
        query,
        done: true,
      };
    }
  }

  const hasMorePca = hasPorsche ? !nextCursor["Porsche Club of America"]?.done : false;
  const hasMore = keywords.some((k) => !nextCursor[k]?.done) || hasMorePca;

  return Response.json({
    configured: true,
    groups,
    pcaGroups,
    failures,
    cursor: JSON.stringify(nextCursor),
    hasMore,
    generatedAt: new Date().toISOString(),
  });
}

