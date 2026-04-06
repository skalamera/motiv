"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Car as CarIcon, Wrench, AlertTriangle, Gauge, Loader2 } from "lucide-react";
import type { CarWithMeta } from "@/lib/data/cars";
import { createClient } from "@/lib/supabase/client";
import { useCarSelection } from "@/hooks/use-car-selection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatCards({ data }: { data: CarWithMeta[] }) {
  const router = useRouter();
  const [milesOpen, setMilesOpen] = useState(false);
  const [selectedCarId, setSelectedCarId] = useCarSelection("");
  const [newMileage, setNewMileage] = useState("");
  const [saving, setSaving] = useState(false);

  // Initialize when data is loaded
  useEffect(() => {
    // Only set initial state if we haven't selected a car yet
    if (data.length > 0 && !selectedCarId) {
      setSelectedCarId(data[0].car.id);
      setNewMileage(String(data[0].car.mileage));
    }
  }, [data, selectedCarId]);

  const handleCarChange = (val: string | null) => {
    if (!val) return;
    setSelectedCarId(val);
    const car = data.find((d) => d.car.id === val);
    if (car) setNewMileage(String(car.car.mileage));
  };

  const totalCars = data.length;
  const totalRecalls = data.reduce((n, d) => n + d.recallCount, 0);
  const totalSchedules = data.reduce((n, d) => n + d.schedules.length, 0);
  const totalMiles = data.reduce((n, d) => n + d.car.mileage, 0);

  async function updateMileage() {
    if (!selectedCarId || !newMileage) return;
    setSaving(true);
    const supabase = createClient();
    const mi = parseInt(newMileage, 10);
    const { error } = await supabase
      .from("cars")
      .update({ mileage: mi })
      .eq("id", selectedCarId);
    
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setMilesOpen(false);
    router.refresh();
  }

  const stats = [
    {
      label: "Vehicles",
      value: totalCars,
      icon: CarIcon,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/settings#my-garage",
    },
    {
      label: "Total miles",
      value: totalMiles.toLocaleString(),
      icon: Gauge,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      action: () => setMilesOpen(true),
    },
    {
      label: "Schedule items",
      value: totalSchedules,
      icon: Wrench,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
      href: "/maintenance",
    },
    {
      label: "Open recalls",
      value: totalRecalls,
      icon: AlertTriangle,
      color: totalRecalls > 0 ? "text-destructive" : "text-emerald-500",
      bg: totalRecalls > 0 ? "bg-destructive/10" : "bg-emerald-500/10",
      href: "/recalls",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => {
          const CardContent = (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-muted/50"
              onClick={s.action}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}
              >
                <s.icon className={`size-4 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight">
                  {s.value}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          );

          if (s.href) {
            return (
              <Link key={s.label} href={s.href} className="block">
                {CardContent}
              </Link>
            );
          }

          return CardContent;
        })}
      </div>

      <Dialog open={milesOpen} onOpenChange={setMilesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Mileage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Select value={selectedCarId} onValueChange={handleCarChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a car" />
                </SelectTrigger>
                <SelectContent>
                  {data.map((d) => (
                    <SelectItem 
                      key={d.car.id} 
                      value={d.car.id}
                      label={`${d.car.year} ${d.car.make} ${d.car.model}`}
                    >
                      {d.car.year} {d.car.make} {d.car.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Mileage</Label>
              <Input
                type="number"
                value={newMileage}
                onChange={(e) => setNewMileage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void updateMileage()} disabled={saving || !newMileage}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
