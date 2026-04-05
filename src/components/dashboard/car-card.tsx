"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gauge, AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import type { Car, MaintenanceSchedule } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function nextMaintenanceSummary(
  car: Car,
  schedules: MaintenanceSchedule[],
): string {
  if (schedules.length === 0) return "No schedule yet — generate or add items.";
  const withMiles = schedules
    .filter((s) => s.interval_miles && s.last_mileage_at != null)
    .map((s) => ({
      task: s.task,
      dueAt: (s.last_mileage_at ?? 0) + (s.interval_miles ?? 0),
    }))
    .filter((x) => x.dueAt > car.mileage)
    .sort((a, b) => a.dueAt - b.dueAt)[0];

  if (withMiles) {
    const remaining = withMiles.dueAt - car.mileage;
    return `${withMiles.task} in ~${remaining.toLocaleString()} mi`;
  }

  const byMonth = schedules.find((s) => s.interval_months);
  if (byMonth) {
    return `${byMonth.task} (every ${byMonth.interval_months} mo)`;
  }

  return schedules[0]?.task ?? "Review maintenance list";
}

export function CarCard({
  car,
  schedules,
  recallCount,
  index,
}: {
  car: Car;
  schedules: MaintenanceSchedule[];
  recallCount: number;
  index: number;
}) {
  const nextLine = nextMaintenanceSummary(car, schedules);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className="glass-card border-white/10 bg-card/50 overflow-hidden backdrop-blur-md transition-shadow hover:shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              {car.year} {car.make} {car.model}
              {car.trim ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  {car.trim}
                </span>
              ) : null}
            </CardTitle>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1">
                <Gauge className="size-3.5" />
                {car.mileage.toLocaleString()} mi
              </span>
              {recallCount > 0 ? (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <AlertTriangle className="size-3" />
                  {recallCount} recall{recallCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  No open recalls (NHTSA)
                </Badge>
              )}
            </div>
          </div>
          <Link
            href="/maintenance"
            aria-label="Maintenance"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "inline-flex",
            )}
          >
            <ChevronRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted/40 flex items-start gap-2 rounded-lg border border-white/5 p-3 text-sm">
            <CalendarClock className="text-primary mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Next focus
              </p>
              <p className="mt-0.5">{nextLine}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/chat?car=${car.id}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "secondary" }),
                "inline-flex",
              )}
            >
              Ask Motiv
            </Link>
            <Link
              href={`/recalls?car=${car.id}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "inline-flex",
              )}
            >
              Recalls
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
