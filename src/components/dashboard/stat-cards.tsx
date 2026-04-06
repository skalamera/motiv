"use client";

import { motion } from "framer-motion";
import { Car as CarIcon, Wrench, AlertTriangle, Gauge } from "lucide-react";
import type { CarWithMeta } from "@/lib/data/cars";

export function StatCards({ data }: { data: CarWithMeta[] }) {
  const totalCars = data.length;
  const totalRecalls = data.reduce((n, d) => n + d.recallCount, 0);
  const totalSchedules = data.reduce((n, d) => n + d.schedules.length, 0);
  const totalMiles = data.reduce((n, d) => n + d.car.mileage, 0);

  const stats = [
    {
      label: "Vehicles",
      value: totalCars,
      icon: CarIcon,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total miles",
      value: totalMiles.toLocaleString(),
      icon: Gauge,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Schedule items",
      value: totalSchedules,
      icon: Wrench,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      label: "Open recalls",
      value: totalRecalls,
      icon: AlertTriangle,
      color: totalRecalls > 0 ? "text-destructive" : "text-emerald-500",
      bg: totalRecalls > 0 ? "bg-destructive/10" : "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 backdrop-blur-sm"
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
      ))}
    </div>
  );
}
