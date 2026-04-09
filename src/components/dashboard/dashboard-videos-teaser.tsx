"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PlayCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VideoResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
};

type KeywordVideos = { keyword: string; videos: VideoResult[] };

const PICK = 4;

function shufflePickUnique(videos: VideoResult[], n: number): VideoResult[] {
  const seen = new Set<string>();
  const unique: VideoResult[] = [];
  for (const v of videos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    unique.push(v);
  }
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, n);
}

function flattenVideos(body: {
  groups?: KeywordVideos[];
  pcaGroups?: KeywordVideos[];
  cncGroups?: KeywordVideos[];
}): VideoResult[] {
  const out: VideoResult[] = [];
  for (const g of [...(body.cncGroups ?? []), ...(body.pcaGroups ?? []), ...(body.groups ?? [])]) {
    for (const v of g.videos ?? []) out.push(v);
  }
  return out;
}

export function DashboardVideosTeaser() {
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [emptyGarage, setEmptyGarage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch("/api/videos");
        const body = (await res.json()) as {
          configured?: boolean;
          emptyGarage?: boolean;
          groups?: KeywordVideos[];
          pcaGroups?: KeywordVideos[];
          cncGroups?: KeywordVideos[];
        };
        if (cancelled) return;
        if (body.configured === false) {
          setNotConfigured(true);
          setEmptyGarage(false);
          setVideos([]);
          return;
        }
        if (body.emptyGarage) {
          setEmptyGarage(true);
          setNotConfigured(false);
          setVideos([]);
          return;
        }
        setNotConfigured(false);
        setEmptyGarage(false);
        setVideos(shufflePickUnique(flattenVideos(body), PICK));
      } catch {
        if (!cancelled) {
          setVideos([]);
          setNotConfigured(false);
          setEmptyGarage(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-base">Videos for you</CardTitle>
          <CardDescription>
            A few random picks from the same feed as the Videos page.
          </CardDescription>
        </div>
        <Link
          href="/videos"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 rounded-xl",
          )}
        >
          All videos
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading picks…
          </div>
        ) : notConfigured ? (
          <p className="text-muted-foreground text-sm">
            Set{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">YOUTUBE_API_KEY</code>{" "}
            to load personalized videos.{" "}
            <Link href="/videos" className="text-primary underline">
              Videos page
            </Link>
          </p>
        ) : emptyGarage ? (
          <p className="text-muted-foreground text-sm">
            Add a vehicle in{" "}
            <Link href="/garage" className="text-primary underline">
              Garage
            </Link>{" "}
            for YouTube picks tailored to your garage, or open{" "}
            <Link href="/videos" className="text-primary underline">
              Videos
            </Link>
            .
          </p>
        ) : videos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No clips loaded yet.{" "}
            <Link href="/videos" className="text-primary underline underline-offset-2">
              Try the Videos page
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {videos.map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border-border/50 bg-card/60 hover:border-primary/30 hover:bg-accent/40 overflow-hidden rounded-xl border transition-colors"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.thumbnail}
                    alt=""
                    className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition-transform group-hover:scale-105">
                      <PlayCircle className="size-7" />
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug">
                    {v.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-[0.65rem]">
                    {v.channelTitle}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
