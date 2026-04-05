"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import type { NewsArticle } from "@/lib/news";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NewsFeed() {
  const [cars, setCars] = useState<Car[]>([]);
  const [overrideTab, setOverrideTab] = useState<string | null>(null);

  const makes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cars) {
      const key = c.make.trim().toLowerCase();
      if (!m.has(key)) m.set(key, c.make.trim());
    }
    return Array.from(m.entries());
  }, [cars]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => setCars((data ?? []) as Car[]));
  }, []);

  const defaultMakeKey = makes[0]?.[0] ?? "";
  const tab = overrideTab ?? defaultMakeKey;

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle to see headlines for that manufacturer.
      </p>
    );
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setOverrideTab(v)}>
      <ScrollArea className="w-full pb-2">
        <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {makes.map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border px-3 py-1 text-xs capitalize"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>

      {makes.map(([key, label]) => (
        <TabsContent key={key} value={key} className="mt-4">
          <NewsForMake make={label} slug={key} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function NewsForMake({ make, slug }: { make: string; slug: string }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => setLoading(true));
    void fetch(`/api/news?make=${encodeURIComponent(make)}`)
      .then(async (res) => {
        const j = await res.json();
        if (cancelled) return;
        if (!j.configured) {
          setMsg(j.message ?? "News API not configured.");
          setArticles([]);
        } else if (j.error) {
          setMsg(j.error);
          setArticles([]);
        } else {
          setMsg(null);
          setArticles(j.articles ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setMsg("Failed to load news.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [make, slug]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading headlines…
      </div>
    );
  }

  if (msg) {
    return <p className="text-muted-foreground text-sm">{msg}</p>;
  }

  if (articles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No articles found.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {articles.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="group block"
        >
          <Card className="glass-card border-white/10 bg-card/40 h-full overflow-hidden transition-colors hover:border-primary/30">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              {a.urlToImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.urlToImage}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : null}
            </div>
            <CardContent className="p-3">
              <p className="line-clamp-2 font-medium leading-snug">{a.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {a.source.name} ·{" "}
                {a.publishedAt
                  ? new Date(a.publishedAt).toLocaleDateString()
                  : ""}
              </p>
              {a.description ? (
                <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                  {a.description.replace(/<[^>]+>/g, "")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}
