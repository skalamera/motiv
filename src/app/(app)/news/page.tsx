import { NewsFeed } from "@/components/news/news-feed";

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">News</h1>
        <p className="text-muted-foreground text-sm">
          Headlines for your manufacturers via NewsAPI. Set{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">NEWS_API_KEY</code>{" "}
          in production.
        </p>
      </div>
      <NewsFeed />
    </div>
  );
}
