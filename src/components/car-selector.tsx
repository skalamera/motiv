"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCarSelection } from "@/hooks/use-car-selection";

type Props = {
  value: string | null;
  onChange: (carId: string | null) => void;
  label?: string;
  className?: string;
  /** Merged into SelectContent (e.g. `dark` when the menu is portaled outside a .dark subtree). */
  selectContentClassName?: string;
};

export function carDisplayName(c: Car): string {
  const t = [c.year, c.make, c.model, c.trim].filter(Boolean).join(" ");
  return t || "Vehicle";
}

export function CarSelector({
  value,
  onChange,
  label = "Vehicle",
  className,
  selectContentClassName,
}: Props) {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [persistedId, setPersistedId] = useCarSelection("");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setCars(data as Car[]);
        setLoading(false);
      });
  }, []);

  // Sync with persisted id when loaded
  useEffect(() => {
    if (!loading && cars.length > 0) {
      if (!value && persistedId && cars.some(c => c.id === persistedId)) {
        onChange(persistedId);
      } else if (value && value !== persistedId) {
        setPersistedId(value);
      }
    }
  }, [loading, cars, value, persistedId, onChange, setPersistedId]);

  const handleChange = (v: string | null) => {
    setPersistedId(v || "");
    onChange(v);
  };

  if (loading && cars.length === 0) {
    return (
      <div className={className}>
        {label ? (
          <Label className="text-muted-foreground mb-2 block text-xs">{label}</Label>
        ) : null}
        <div className="bg-muted h-9 animate-pulse rounded-md" />
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle in Settings to unlock context-aware help.
      </p>
    );
  }

  return (
    <div className={className}>
      {label ? (
        <Label className="text-muted-foreground mb-2 block text-xs">{label}</Label>
      ) : null}
      <Select
        modal={false}
        value={value ?? ""}
        onValueChange={(v) => handleChange(v === "" ? null : v)}
      >
        <SelectTrigger className="h-auto min-h-9 w-full min-w-[min(100%,22rem)] max-w-xl bg-background/50 text-foreground sm:min-w-[26rem]">
          <SelectValue placeholder="Any / not specified">
            {(v) => {
              if (v == null || v === "") return "Any / not specified";
              const c = cars.find((car) => car.id === v);
              if (!c) return "Any / not specified";
              return (
                <span className="flex min-w-0 items-center gap-2 text-left">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image_url}
                      alt=""
                      className="size-7 shrink-0 rounded-md object-cover ring-1 ring-border/60"
                    />
                  ) : (
                    <span className="bg-muted/80 size-7 shrink-0 rounded-md ring-1 ring-border/40" />
                  )}
                  <span className="truncate">{carDisplayName(c)}</span>
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className={cn(
            "max-w-[min(100vw-1.5rem,40rem)]",
            selectContentClassName,
          )}
        >
          <SelectItem value="">Any / not specified</SelectItem>
          {cars.map((c) => (
            <SelectItem
              key={c.id}
              value={c.id}
              label={carDisplayName(c)}
              className="items-start py-2.5"
            >
              <span className="flex items-center gap-2">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt=""
                    className="size-8 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="bg-muted size-8 shrink-0 rounded-md" />
                )}
                <span className="whitespace-normal">{carDisplayName(c)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
