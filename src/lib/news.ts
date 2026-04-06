export type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

type NewsApiResponse = {
  status: string;
  articles?: NewsArticle[];
  message?: string;
};

export async function fetchCarNews(
  query: string,
  apiKey: string,
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    q: query,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "20",
    apiKey,
  });
  const url = `https://newsapi.org/v2/everything?${params}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`News API ${res.status}: ${t}`);
  }
  const json = (await res.json()) as NewsApiResponse;
  if (json.status !== "ok" || !json.articles) {
    throw new Error(json.message ?? "News API error");
  }
  return json.articles;
}

export const MAX_MAKES_PER_REQUEST = 15;

/** Dedupe by URL and sort newest first (for multi-manufacturer feeds). */
export function mergeNewsArticlesByRecency(
  groups: NewsArticle[][],
): NewsArticle[] {
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const articles of groups) {
    for (const a of articles) {
      const u = a.url;
      if (!u || seen.has(u)) continue;
      seen.add(u);
      merged.push(a);
    }
  }
  merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return merged;
}
