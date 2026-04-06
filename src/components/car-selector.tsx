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

type Props = {
  value: string | null;
  onChange: (carId: string | null) => void;
  label?: string;
  className?: string;
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
}: Props) {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

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
        onValueChange={(v) => onChange(v === "" ? null : v)}
      >
        <SelectTrigger className="bg-background/50 h-auto min-h-9 w-full min-w-[min(100%,22rem)] max-w-xl sm:min-w-[26rem]">
          <SelectValue placeholder="Any / not specified">
            {(v) => {
              if (v == null || v === "") return "Any / not specified";
              const c = cars.find((car) => car.id === v);
              return c ? carDisplayName(c) : "Any / not specified";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-1.5rem,40rem)]">
          <SelectItem value="">Any / not specified</SelectItem>
          {cars.map((c) => (
            <SelectItem
              key={c.id}
              value={c.id}
              label={carDisplayName(c)}
              className="items-start py-2.5"
            >
              <span className="whitespace-normal">{carDisplayName(c)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
