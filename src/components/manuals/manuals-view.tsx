"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, Manual } from "@/types/database";
import { carDisplayName } from "@/components/car-selector";
import { ManualChatFab } from "@/components/manuals/manual-chat-fab";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ManualRow = Manual & { car: Car };

export function ManualsView() {
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: cars, error: cErr } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true });
    if (cErr || !cars?.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const list: ManualRow[] = [];
    for (const car of cars as Car[]) {
      const { data: manuals } = await supabase
        .from("manuals")
        .select("*")
        .eq("car_id", car.id)
        .order("created_at", { ascending: true });
      for (const m of (manuals ?? []) as Manual[]) {
        list.push({ ...m, car });
      }
    }
    setRows(list);
    setLoading(false);
    setSelectedId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    setPdfLoading(true);
    const supabase = createClient();
    void supabase.storage
      .from("manuals")
      .createSignedUrl(selected.storage_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPdfUrl(null);
        } else {
          setPdfUrl(data.signedUrl);
        }
        setPdfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const manualLabel = selected
    ? `${carDisplayName(selected.car)} — ${selected.file_name}`
    : "";

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading manuals…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-border/50 rounded-2xl border border-dashed bg-card/40 p-10 text-center backdrop-blur-sm">
        <FileText className="text-muted-foreground mx-auto mb-3 size-10" />
        <p className="text-muted-foreground mb-4 text-sm">
          No PDFs yet. Upload owner&apos;s manuals from Settings for any vehicle.
        </p>
        <Link href="/settings" className={buttonVariants()}>
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="border-border/50 w-full shrink-0 rounded-xl border bg-card/40 backdrop-blur-sm lg:w-72">
        <div className="border-border/50 border-b px-3 py-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Your PDFs
          </p>
        </div>
        <ScrollArea className="h-[min(40vh,320px)] lg:h-[min(calc(100dvh-12rem),720px)]">
          <ul className="p-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "hover:bg-accent/60 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    selectedId === r.id
                      ? "bg-accent/80 text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="line-clamp-2 font-medium">
                    {carDisplayName(r.car)}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block line-clamp-2 text-xs">
                    {r.file_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      <div className="border-border/50 relative min-h-[min(60vh,560px)] flex-1 overflow-hidden rounded-xl border bg-card/30 backdrop-blur-sm">
        {selected ? (
          <>
            <div className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <p className="text-muted-foreground min-w-0 text-xs sm:text-sm">
                <span className="text-foreground font-medium">
                  {carDisplayName(selected.car)}
                </span>
                <span className="mx-1.5 text-border">·</span>
                <span className="line-clamp-2">{selected.file_name}</span>
              </p>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "shrink-0 text-xs",
                  )}
                >
                  <ExternalLink className="mr-1 size-3" />
                  Open
                </a>
              ) : null}
            </div>
            <div className="relative h-[min(55vh,640px)] w-full flex-1 bg-muted/20 lg:h-[min(calc(100dvh-14rem),720px)]">
              {pdfLoading ? (
                <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-5 animate-spin" />
                  Loading PDF…
                </div>
              ) : pdfUrl ? (
                <iframe
                  title={selected.file_name}
                  src={pdfUrl}
                  className="size-full min-h-[480px] border-0"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
                  Could not load this PDF. Try again or re-upload from Settings.
                </div>
              )}
            </div>

            <ManualChatFab
              carId={selected.car_id}
              manualId={selected.id}
              manualLabel={manualLabel}
            />
          </>
        ) : (
          <p className="text-muted-foreground p-6 text-sm">Select a manual.</p>
        )}
      </div>
    </div>
  );
}
