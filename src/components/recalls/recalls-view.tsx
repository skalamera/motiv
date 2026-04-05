"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import type { NhtsaRecall } from "@/lib/nhtsa";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function RecallsView({ initialCarId }: { initialCarId: string | null }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [overrideTab, setOverrideTab] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, NhtsaRecall[]>>({});
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

  const tab = overrideTab ?? defaultTabId;

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

  const sortedKeys = useMemo(() => cars.map((c) => c.id), [cars]);

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle in Settings to load NHTSA recalls.
      </p>
    );
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setOverrideTab(v)}>
      <ScrollArea className="w-full pb-2">
        <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {cars.map((c) => (
            <TabsTrigger
              key={c.id}
              value={c.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border px-3 py-1 text-xs"
            >
              {c.year} {c.make} {c.model}
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>

      {sortedKeys.map((id) => {
        const recalls = cache[id];
        const err = errors[id];
        const ld = loading[id];
        return (
          <TabsContent key={id} value={id} className="mt-4 space-y-3">
            {ld ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading NHTSA data…
              </div>
            ) : null}
            {err ? (
              <p className="text-destructive text-sm">{err}</p>
            ) : null}
            {!ld && !err && recalls && recalls.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No recalls returned for this vehicle in the NHTSA database
                (check make/model spelling and year).
              </p>
            ) : null}
            {recalls?.map((r, i) => (
              <Card key={i} className="glass-card border-white/10 bg-card/40">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {r.Component ?? "Recall"}
                    </CardTitle>
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
                      <span className="text-muted-foreground font-medium">
                        Summary:{" "}
                      </span>
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
                      <span className="text-muted-foreground font-medium">
                        Remedy:{" "}
                      </span>
                      {r.Remedy}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
