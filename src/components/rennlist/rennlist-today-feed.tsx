"use client";

import { useEffect, useState } from "react";
import { Loader2, Rss } from "lucide-react";
import type { RennlistTodayFetchResult } from "@/lib/rennlist/types";
import { RENNLIST_TODAY_POSTS_URL } from "@/lib/rennlist/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function coerceResult(raw: unknown): RennlistTodayFetchResult | null {
  if (!isRecord(raw)) return null;
  if (raw.ok === true) {
    const threads = raw.threads;
    const fetchedAt = raw.fetchedAt;
    const sourceUrl = raw.sourceUrl;
    if (!Array.isArray(threads) || typeof fetchedAt !== "string" || typeof sourceUrl !== "string") {
      return null;
    }
    return { ok: true, threads, fetchedAt, sourceUrl } as RennlistTodayFetchResult;
  }
  if (raw.ok === false) {
    const err = raw.error;
    const sourceUrl = raw.sourceUrl;
    if (typeof err !== "string" || typeof sourceUrl !== "string") return null;
    return { ok: false, error: err, sourceUrl };
  }
  return null;
}

export function RennlistTodayFeed() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; result: RennlistTodayFetchResult }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/rennlist/today", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const text = await res.text();
        let raw: unknown;
        try {
          raw = JSON.parse(text) as unknown;
        } catch {
          if (!cancelled) {
            setState({
              kind: "error",
              message: `Reader API HTTP ${res.status} (not JSON).`,
            });
          }
          return;
        }
        const result = coerceResult(raw);
        if (!result) {
          if (!cancelled) setState({ kind: "error", message: "Unexpected reader response shape." });
          return;
        }
        if (!cancelled) setState({ kind: "ready", result });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "Network error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading Rennlist...
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="border-destructive/40 bg-destructive/5 rounded-xl border p-4 text-sm">
        <p className="font-medium text-destructive">Could not load Rennlist</p>
        <p className="text-muted-foreground mt-1">{state.message}</p>
        <a
          href={RENNLIST_TODAY_POSTS_URL}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 inline-flex")}
        >
          Open Rennlist directly
        </a>
      </div>
    );
  }

  const { result } = state;

  return (
    <>
      {result.ok ? (
        <>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <Rss className="size-3.5" />
            <span>
              {result.threads.length} thread{result.threads.length === 1 ? "" : "s"} &middot; refreshed
              at{" "}
              {(() => {
                try {
                  const d = new Date(result.fetchedAt);
                  return Number.isNaN(d.getTime())
                    ? result.fetchedAt
                    : d.toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });
                } catch {
                  return result.fetchedAt;
                }
              })()}
            </span>
            <a
              href={result.sourceUrl}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-7 gap-1 px-2 text-xs",
              )}
            >
              View on Rennlist
            </a>
          </div>

          {result.threads.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No 991.2 / 991-forum threads with activity today, or Rennlist
              changed their layout. Try{" "}
              <a
                href={result.sourceUrl}
                className="text-primary underline-offset-2 hover:underline"
              >
                full today&apos;s posts on Rennlist
              </a>
              .
            </p>
          ) : (
            <ul className="divide-border/60 border-border/60 divide-y rounded-xl border bg-card/40">
              {result.threads.map((t, i) => (
                <li key={t.url || `thread-${i}`} className="px-4 py-3.5">
                  <a
                    href={t.url}
                    className="font-medium leading-snug hover:underline"
                  >
                    {String(t.title ?? "")}
                  </a>
                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    <span>{String(t.lastActivityText ?? "")}</span>
                    {t.forumName ? (
                      <>
                        <span aria-hidden>&middot;</span>
                        {t.forumUrl ? (
                          <a
                            href={t.forumUrl}
                            className="hover:text-foreground underline-offset-2 hover:underline"
                          >
                            {String(t.forumName)}
                          </a>
                        ) : (
                          <span>{String(t.forumName)}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="border-destructive/40 bg-destructive/5 rounded-xl border p-4 text-sm">
          <p className="font-medium text-destructive">Could not load Rennlist</p>
          <p className="text-muted-foreground mt-1">{result.error}</p>
          <a
            href={result.sourceUrl}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-3 inline-flex",
            )}
          >
            Open Rennlist directly
          </a>
        </div>
      )}

      <p className="text-muted-foreground mt-8 text-[0.7rem] leading-relaxed">
        Content and trademarks belong to Rennlist and its contributors. Use of this page is subject to{" "}
        <a
          href="https://rennlist.com/forums/terms-of-service/"
          className="underline-offset-2 hover:underline"
        >
          Rennlist&apos;s terms
        </a>
        ; Motiv does not host forum posts.
      </p>
    </>
  );
}
