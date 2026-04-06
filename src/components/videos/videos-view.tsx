"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import { Loader2, RefreshCw, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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

export function VideosView() {
  const [cars, setCars] = useState<Car[]>([]);
  const [garageLoading, setGarageLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [groups, setGroups] = useState<KeywordVideos[]>([]);
  const [pcaGroups, setPcaGroups] = useState<KeywordVideos[]>([]);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<KeywordFailure[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setCars(data as Car[]);
        setGarageLoading(false);
      });
  }, []);

  const keywordLabels = useMemo(
    () =>
      [...new Set(cars.map((c) => [c.make, c.model].filter(Boolean).join(" ").trim()).filter(Boolean))],
    [cars],
  );

  function mergeGroups(
    prev: KeywordVideos[],
    incoming: KeywordVideos[],
  ): KeywordVideos[] {
    const map = new Map<string, Map<string, VideoResult>>();
    for (const group of prev) {
      const videosById = new Map<string, VideoResult>();
      for (const v of group.videos) videosById.set(v.id, v);
      map.set(group.keyword, videosById);
    }
    for (const group of incoming) {
      const videosById = map.get(group.keyword) ?? new Map<string, VideoResult>();
      for (const v of group.videos) videosById.set(v.id, v);
      map.set(group.keyword, videosById);
    }
    return Array.from(map.entries()).map(([keyword, videosById]) => ({
      keyword,
      videos: Array.from(videosById.values()),
    }));
  }

  async function loadVideos(append: boolean) {
    setVideosLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (append && cursor) params.set("cursor", cursor);
      const res = await fetch(
        `/api/videos${params.toString() ? `?${params.toString()}` : ""}`,
        { method: "GET" },
      );
      const body = (await res.json()) as {
        configured?: boolean;
        groups?: KeywordVideos[];
        pcaGroups?: KeywordVideos[];
        failures?: KeywordFailure[];
        cursor?: string;
        hasMore?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error || "Could not load videos");
        if (!append) {
          setGroups([]);
          setPcaGroups([]);
        }
        setFailures([]);
        if (!append) {
          setCursor(null);
          setHasMore(true);
        }
        return;
      }
      if (body.configured === false) {
        setNotConfigured(true);
        setGroups([]);
        setPcaGroups([]);
        setFailures([]);
        setCursor(null);
        setHasMore(false);
        return;
      }
      setNotConfigured(false);
      setGroups((prev) =>
        append ? mergeGroups(prev, body.groups ?? []) : body.groups ?? [],
      );
      setPcaGroups((prev) =>
        append ? mergeGroups(prev, body.pcaGroups ?? []) : body.pcaGroups ?? [],
      );
      setFailures(body.failures ?? []);
      setCursor(body.cursor ?? null);
      setHasMore(Boolean(body.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load videos");
      if (!append) {
        setGroups([]);
        setPcaGroups([]);
      }
      setFailures([]);
    } finally {
      setVideosLoading(false);
    }
  }

  useEffect(() => {
    if (garageLoading || cars.length === 0) return;
    setCursor(null);
    setHasMore(true);
    void loadVideos(false);
    // Intentionally refresh when garage contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageLoading, cars.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || videosLoading || notConfigured || garageLoading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !videosLoading && hasMore) {
          void loadVideos(true);
        }
      },
      { root: null, rootMargin: "300px 0px", threshold: 0.01 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, videosLoading, notConfigured, garageLoading, cursor]);

  if (garageLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading your garage…
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle in Settings. We&apos;ll show random YouTube videos using your
        car&apos;s make and model as search keywords.
      </p>
    );
  }

  if (notConfigured) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Set <code className="rounded bg-muted px-1 py-0.5 text-[11px]">YOUTUBE_API_KEY</code>{" "}
          to load personalized YouTube videos.
        </p>
      </div>
    );
  }

  if (videosLoading && groups.length === 0 && pcaGroups.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading personalized videos…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadVideos(false)}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (groups.length === 0 && pcaGroups.length === 0) {
    return (
      <div className="space-y-2 text-sm">
        {failures.length > 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed">
            <p className="font-medium text-foreground">
              YouTube API returned errors for your keyword searches.
            </p>
            <p className="text-muted-foreground mt-1">
              Most common fix: enable <strong>YouTube Data API v3</strong> and use
              a server-compatible API key (no HTTP referrer restriction), then
              restrict by API to YouTube Data API v3.
            </p>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {failures.slice(0, 3).map((f) => (
                <li key={f.keyword}>
                  {f.keyword}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-muted-foreground">
          No videos found for your current garage keywords (
          {keywordLabels.join(", ")}).
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadVideos(false)}
        >
          Refresh search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setCursor(null);
            setHasMore(true);
            void loadVideos(false);
          }}
          disabled={videosLoading}
        >
          <RefreshCw className={videosLoading ? "mr-1.5 size-3.5 animate-spin" : "mr-1.5 size-3.5"} />
          Refresh random videos
        </Button>
      </div>

      {pcaGroups.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pca.svg"
              alt="PCA"
              className="size-8 object-contain dark:invert"
            />
            <h2 className="text-xl font-semibold tracking-tight">Porsche Club of America</h2>
          </div>
          {pcaGroups.map((group) => (
            <Card
              key={group.keyword}
              className="glass-card border-border overflow-hidden bg-card/40"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recent Videos</CardTitle>
                <p className="text-muted-foreground text-xs">
                  From the official Porsche Club of America YouTube channel
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.videos.map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setActiveVideoId(v.id)}
                      className="group border-border/50 bg-card/60 hover:border-primary/30 hover:bg-accent/50 block overflow-hidden rounded-xl border transition-all text-left w-full"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02] opacity-80 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 p-3 rounded-full text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                            <PlayCircle className="size-8" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {v.title}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          {v.channelTitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Videos for you</h2>
          {groups.map((group) => (
            <Card
              key={group.keyword}
              className="glass-card border-border overflow-hidden bg-card/40"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{group.keyword}</CardTitle>
                <p className="text-muted-foreground text-xs">
                  Random YouTube results based on your car&apos;s make + model keyword
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.videos.map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setActiveVideoId(v.id)}
                      className="group border-border/50 bg-card/60 hover:border-primary/30 hover:bg-accent/50 block overflow-hidden rounded-xl border transition-all text-left w-full"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02] opacity-80 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 p-3 rounded-full text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                            <PlayCircle className="size-8" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {v.title}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          {v.channelTitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!activeVideoId} onOpenChange={(open) => !open && setActiveVideoId(null)}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-black border-border/50">
          <DialogTitle className="sr-only">Video Player</DialogTitle>
          <div className="relative w-full aspect-video bg-black flex items-center justify-center">
            {activeVideoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <div ref={sentinelRef} className="h-6" />
      {videosLoading && groups.length > 0 ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading more videos…
        </div>
      ) : null}
      {!hasMore && groups.length > 0 ? (
        <p className="text-muted-foreground text-center text-xs">
          You&apos;ve reached the end of available results.
        </p>
      ) : null}
    </div>
  );
}
