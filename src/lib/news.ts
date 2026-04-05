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
