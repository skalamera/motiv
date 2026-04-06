"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import type { NhtsaRecall, RecallLookupMeta } from "@/lib/nhtsa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCarSelection } from "@/hooks/use-car-selection";

export function RecallsView({ initialCarId }: { initialCarId: string | null }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [overrideTab, setOverrideTab] = useCarSelection("");
  const [cache, setCache] = useState<Record<string, NhtsaRecall[]>>({});
  const [lookupCache, setLookupCache] = useState<
    Record<string, RecallLookupMeta | undefined>
  >({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Car[];
        setCars(list);
      });
  }, []);

  const defaultTabId = useMemo(() => {
    if (cars.length === 0) return "";
    if (initialCarId && cars.some((c) => c.id === initialCarId)) {
      return initialCarId;
    }
    return cars[0].id;
  }, [cars, initialCarId]);

  const tab = overrideTab && cars.some(c => c.id === overrideTab) ? overrideTab : defaultTabId;

  // Sync to local storage if not already there
  useEffect(() => {
    if (tab && tab !== overrideTab) {
      setOverrideTab(tab);
    }
  }, [tab, overrideTab, setOverrideTab]);

  useEffect(() => {
    if (!tab) return;
    let cancelled = false;
    startTransition(() => {
      setLoading((m) => ({ ...m, [tab]: true }));
      setErrors((m) => {
        const n = { ...m };
        delete n[tab];
        return n;
      });
    });
    void fetch(`/api/recalls?carId=${encodeURIComponent(tab)}`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        setCache((m) => ({ ...m, [tab]: json.recalls ?? [] }));
        setLookupCache((m) => ({ ...m, [tab]: json.lookup as RecallLookupMeta }));
      })
      .catch((e) => {
        if (!cancelled) {
          setErrors((m) => ({
            ...m,
            [tab]: e instanceof Error ? e.message : "Failed to load",
          }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading((m) => ({ ...m, [tab]: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const currentRecalls = tab ? cache[tab] : undefined;
  const currentLookup = tab ? lookupCache[tab] : undefined;
  const currentError = tab ? errors[tab] : undefined;
  const currentLoading = tab ? loading[tab] : false;
  const currentCar = tab ? cars.find((c) => c.id === tab) : undefined;

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle in Settings to load NHTSA recalls.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xl">
        <Select value={tab} onValueChange={(v) => setOverrideTab(v || "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a vehicle">
              {(v) => {
                const c = cars.find((car) => car.id === v);
                if (!c) return "Select a vehicle";
                return `${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-w-[min(100vw-1.5rem,44rem)]">
            {cars.map((c) => (
              <SelectItem
                key={c.id}
                value={c.id}
                label={`${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}`}
                className="items-start py-2.5"
              >
                <span className="whitespace-normal">
                  {c.year} {c.make} {c.model}
                  {c.trim ? ` ${c.trim}` : ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {currentLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading NHTSA data…
        </div>
      ) : null}
      {currentError ? (
        <p className="text-destructive text-sm">{currentError}</p>
      ) : null}
      {!currentLoading && !currentError && currentLookup ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {currentLookup.mode === "vin_decode" ? (
            <>
              <span className="text-foreground font-medium">Matched using your VIN</span>{" "}
              (NHTSA VPIC decode → recalls for {currentLookup.queried.modelYear}{" "}
              {currentLookup.queried.make} {currentLookup.queried.model}). Open recalls
              for your exact build can differ; confirm with a dealer or{" "}
              <a
                href="https://www.nhtsa.gov/recalls"
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                NHTSA
              </a>
              .
            </>
          ) : (
            <>
              <span className="text-foreground font-medium">
                Matched using saved vehicle
              </span>{" "}
              ({currentLookup.queried.modelYear} {currentLookup.queried.make}{" "}
              {currentLookup.queried.model}).
              {currentLookup.invalidVinFormat ? (
                <>
                  {" "}
                  Your VIN doesn&apos;t match the 17-character format (letters exclude
                  I, O, Q). Fix it in Settings for VPIC-based lookup.
                </>
              ) : null}
              {currentLookup.vinDecodeFailed ? (
                <>
                  {" "}
                  NHTSA could not decode your VIN; results use your saved make, model,
                  and year.
                </>
              ) : null}
              {!currentCar?.vin?.trim() &&
              !currentLookup.invalidVinFormat &&
              !currentLookup.vinDecodeFailed ? (
                <>
                  {" "}
                  Add a VIN in Settings to query using NHTSA VPIC decode.
                </>
              ) : null}
            </>
          )}
        </p>
      ) : null}
      {!currentLoading &&
      !currentError &&
      currentRecalls &&
      currentRecalls.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No recalls returned for this vehicle in the NHTSA database (check
          make/model spelling and year).
        </p>
      ) : null}
      {currentRecalls?.map((r, i) => (
        <Card
          key={i}
          className="gradient-border border border-border/50 bg-card/50 backdrop-blur-sm"
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{r.Component ?? "Recall"}</CardTitle>
              {r.NHTSACampaignNumber ? (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {r.NHTSACampaignNumber}
                </Badge>
              ) : null}
            </div>
            {r.ReportReceivedDate ? (
              <p className="text-muted-foreground text-xs">
                Reported {r.ReportReceivedDate}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {r.Summary ? (
              <p>
                <span className="text-muted-foreground font-medium">Summary: </span>
                {r.Summary}
              </p>
            ) : null}
            {r.Consequence ? (
              <p>
                <span className="text-muted-foreground font-medium">
                  Consequence:{" "}
                </span>
                {r.Consequence}
              </p>
            ) : null}
            {r.Remedy ? (
              <p>
                <span className="text-muted-foreground font-medium">Remedy: </span>
                {r.Remedy}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
