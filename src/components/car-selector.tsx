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
        value={value ?? "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? null : v)}
      >
        <SelectTrigger className="bg-background/50 w-full max-w-xs">
          <SelectValue placeholder="Select vehicle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Any / not specified</SelectItem>
          {cars.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.year} {c.make} {c.model}
              {c.trim ? ` ${c.trim}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
