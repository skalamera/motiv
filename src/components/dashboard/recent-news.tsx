"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NewsArticle } from "@/lib/news";
import { motion } from "framer-motion";
import Link from "next/link";
import { ExternalLink, Loader2, Newspaper } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function uniqueMakesFromCars(rows: { make: string }[]): string[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    const m = row.make?.trim();
    if (!m) continue;
    const key = m.toLowerCase();
    if (!map.has(key)) map.set(key, m);
  }
  return Array.from(map.values());
}

export function RecentNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [makeLabels, setMakeLabels] = useState<string[]>([]);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("make")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const makes = uniqueMakesFromCars((data ?? []) as { make: string }[]);
        if (makes.length === 0) {
          setLoading(false);
          return;
        }
        setMakeLabels(makes);
        const qs = makes.map((m) => encodeURIComponent(m)).join(",");
        void fetch(`/api/news?makes=${qs}`)
          .then(async (res) => {
            const j = await res.json();
            if (!j.configured) {
              setNotConfigured(true);
              setArticles([]);
            } else {
              setArticles((j.articles ?? []).slice(0, 4));
            }
          })
          .catch(() => {
            /* swallow — dashboard is best-effort */
          })
          .finally(() => setLoading(false));
      });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <Newspaper className="size-4" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">
              {makeLabels.length === 0
                ? "News"
                : makeLabels.length === 1
                  ? `${makeLabels[0]} News`
                  : "Manufacturer news"}
            </h2>
          </div>
          {makeLabels.length > 1 ? (
            <p className="text-muted-foreground pl-9 text-xs leading-snug">
              {makeLabels.join(" · ")}
            </p>
          ) : null}
        </div>
        <Link
          href="/news"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "rounded-xl text-xs text-muted-foreground",
          )}
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading headlines…
        </div>
      ) : notConfigured ? (
        <p className="text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEWS_API_KEY</code>{" "}
          to see live headlines on your dashboard.
        </p>
      ) : articles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {makeLabels.length > 0
            ? "No recent articles found."
            : "Add a vehicle to see manufacturer news."}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {articles.map((a, i) => (
            <motion.a
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-3 rounded-xl border border-border/50 bg-card/40 p-3 transition-all hover:border-primary/30 hover:bg-accent/60 hover:shadow-sm"
            >
              {a.urlToImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.urlToImage}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <Newspaper className="size-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-primary">
                  {a.title}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {a.source.name}
                  <span className="text-border">·</span>
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                  <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </motion.div>
  );
}
