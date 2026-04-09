"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, Manual, ManualKind } from "@/types/database";
import { carDisplayName } from "@/components/car-selector";
import { ManualChatFab } from "@/components/manuals/manual-chat-fab";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, ExternalLink, ImageIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCarSelection } from "@/hooks/use-car-selection";

type ManualRow = Manual & { car: Car };

function manualKindLabel(kind: ManualKind | null | undefined): string {
  if (kind === "maintenance") return "Maintenance/Service Manual";
  if (kind === "other") return "Other";
  return "Owner's Manual";
}

function isPdfFileName(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function isLikelyImageFileName(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif?f)$/i.test(name);
}

export function ManualsView() {
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [persistedCarId, setPersistedCarId] = useCarSelection("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

    setSelectedId((prev) => {
      if (prev && list.some((r) => r.id === prev)) return prev;
      if (persistedCarId) {
        const forCar = list.filter((r) => r.car_id === persistedCarId);
        if (forCar.length) return forCar[0].id;
      }
      return list[0]?.id ?? null;
    });
  }, [persistedCarId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    if (selected && selected.car_id !== persistedCarId) {
      setPersistedCarId(selected.car_id);
    }
  }, [selected, persistedCarId, setPersistedCarId]);

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const supabase = createClient();
    void supabase.storage
      .from("manuals")
      .createSignedUrl(selected.storage_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPreviewUrl(null);
        } else {
          setPreviewUrl(data.signedUrl);
        }
        setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const orderedCars = useMemo(() => {
    const seen = new Set<string>();
    const cars: Car[] = [];
    for (const r of rows) {
      if (seen.has(r.car_id)) continue;
      seen.add(r.car_id);
      cars.push(r.car);
    }
    return cars;
  }, [rows]);

  const manualsByCarId = useMemo(() => {
    const m = new Map<string, ManualRow[]>();
    for (const r of rows) {
      const arr = m.get(r.car_id) ?? [];
      arr.push(r);
      m.set(r.car_id, arr);
    }
    return m;
  }, [rows]);

  function groupByKind(items: ManualRow[]) {
    const owner: ManualRow[] = [];
    const maintenance: ManualRow[] = [];
    const other: ManualRow[] = [];
    for (const x of items) {
      const k = x.manual_kind ?? "owner";
      if (k === "maintenance") maintenance.push(x);
      else if (k === "other") other.push(x);
      else owner.push(x);
    }
    return { owner, maintenance, other };
  }

  const manualLabel = selected
    ? `${carDisplayName(selected.car)} — ${manualKindLabel(selected.manual_kind)} — ${selected.file_name}`
    : "";

  const showOwnerPdfChat =
    selected &&
    selected.manual_kind === "owner" &&
    isPdfFileName(selected.file_name);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading library…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-border/50 rounded-2xl border border-dashed bg-card/40 p-10 text-center backdrop-blur-sm">
        <FileText className="text-muted-foreground mx-auto mb-3 size-10" />
        <p className="text-muted-foreground mb-4 text-sm">
          No files yet. Add owner&apos;s manual, maintenance references, or other
          documents in Garage for any vehicle.
        </p>
        <Link href="/garage" className={buttonVariants()}>
          Go to Garage
        </Link>
      </div>
    );
  }

  function ManualListButton({ r }: { r: ManualRow }) {
    return (
      <button
        type="button"
        onClick={() => setSelectedId(r.id)}
        className={cn(
          "hover:bg-accent/60 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
          selectedId === r.id
            ? "bg-accent/80 text-foreground"
            : "text-muted-foreground",
        )}
      >
        <span className="line-clamp-2 text-xs font-medium text-foreground">
          {r.file_name}
        </span>
      </button>
    );
  }

  function KindSection({
    title,
    items,
  }: {
    title: string;
    items: ManualRow[];
  }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-3 last:mb-0">
        <p className="text-muted-foreground px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide">
          {title}
        </p>
        <ul className="space-y-0.5">
          {items.map((r) => (
            <li key={r.id}>
              <ManualListButton r={r} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="border-border/50 w-full shrink-0 rounded-xl border bg-card/40 backdrop-blur-sm lg:w-80">
        <div className="border-border/50 border-b px-3 py-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            By vehicle
          </p>
        </div>
        <ScrollArea className="h-[min(40vh,320px)] lg:h-[min(calc(100dvh-12rem),720px)]">
          <div className="p-2 pb-4">
            {orderedCars.map((car) => {
              const items = manualsByCarId.get(car.id) ?? [];
              const { owner, maintenance, other } = groupByKind(items);
              if (items.length === 0) return null;
              return (
                <div
                  key={car.id}
                  className="border-border/40 mb-5 border-b pb-4 last:mb-0 last:border-0 last:pb-0"
                >
                  <p className="text-foreground px-3 py-1.5 text-sm font-semibold tracking-tight">
                    {carDisplayName(car)}
                  </p>
                  <KindSection title="Owner's Manual" items={owner} />
                  <KindSection
                    title="Maintenance / Service Manual"
                    items={maintenance}
                  />
                  <KindSection title="Other" items={other} />
                </div>
              );
            })}
          </div>
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
                <span className="text-foreground/90">
                  {manualKindLabel(selected.manual_kind)}
                </span>
                <span className="mx-1.5 text-border">·</span>
                <span className="line-clamp-2">{selected.file_name}</span>
              </p>
              {previewUrl ? (
                <a
                  href={previewUrl}
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
              {previewLoading ? (
                <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-5 animate-spin" />
                  Loading…
                </div>
              ) : previewUrl ? (
                isPdfFileName(selected.file_name) ? (
                  <iframe
                    title={selected.file_name}
                    src={previewUrl}
                    className="size-full min-h-[480px] border-0"
                  />
                ) : isLikelyImageFileName(selected.file_name) ? (
                  <div className="flex size-full items-center justify-center overflow-auto p-4">
                    {/* Signed Supabase URL — use native img */}
                    <img
                      src={previewUrl}
                      alt={selected.file_name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-sm">
                    <ImageIcon className="size-10 opacity-50" />
                    <p>Preview isn&apos;t available for this file type.</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Open in new tab
                    </a>
                  </div>
                )
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
                  Could not load this file. Try again or re-upload from Settings.
                </div>
              )}
            </div>

            {showOwnerPdfChat ? (
              <ManualChatFab
                carId={selected.car_id}
                manualId={selected.id}
                manualLabel={manualLabel}
              />
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground p-6 text-sm">Select a file.</p>
        )}
      </div>
    </div>
  );
}
