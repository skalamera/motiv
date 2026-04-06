import { NewsFeed } from "@/components/news/news-feed";

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">News</h1>
        <p className="text-muted-foreground text-sm">
          Headlines relevant to you
        </p>
      </div>
      <NewsFeed />
    </div>
  );
}
