"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gauge, AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import type { Car, MaintenanceSchedule } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  computeSuggestedNextMaintenance,
  type MaintenanceLogForSuggestion,
} from "@/lib/maintenance/suggested-next";

export function CarCard({
  car,
  schedules,
  logs,
  recallCount,
  index,
}: {
  car: Car;
  schedules: MaintenanceSchedule[];
  logs: MaintenanceLogForSuggestion[];
  recallCount: number;
  index: number;
}) {
  const suggested = computeSuggestedNextMaintenance(car, schedules, logs);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className="gradient-border group overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
        {car.image_url ? (
          <div className="bg-muted/40 relative aspect-[16/9] w-full overflow-hidden border-b border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- public garage photo URL */}
            <img
              src={car.image_url}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
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
            <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {car.color ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                  {car.color}
                </span>
              ) : null}
              {car.body_type ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                  {car.body_type}
                </span>
              ) : null}
              {car.drivetrain ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                  {car.drivetrain}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                <Gauge className="size-3.5" />
                {car.mileage.toLocaleString()} mi
              </span>
              {recallCount > 0 ? (
                <Badge variant="destructive" className="gap-1 rounded-full text-[10px]">
                  <AlertTriangle className="size-3" />
                  {recallCount} recall{recallCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  No open recalls
                </Badge>
              )}
            </div>
          </div>
          <Link
            href="/maintenance"
            aria-label="Maintenance"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "inline-flex rounded-xl text-muted-foreground transition-colors group-hover:text-primary",
            )}
          >
            <ChevronRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggested.hasRankedNext ? (
            <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-accent/50 p-3 text-sm">
              <CalendarClock className="text-primary mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Suggested next maintenance
                </p>
                <p className="text-muted-foreground mt-0.5 text-[0.65rem] leading-snug">
                  Same computation as the Maintenance page — from your schedule,
                  odometer, and service history only (not AI).
                </p>
                <p className="mt-1 font-medium">{suggested.line}</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/chat?car=${car.id}`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "ai-gradient inline-flex rounded-xl border-0 text-white shadow-sm hover:opacity-90",
              )}
            >
              Ask Motiv
            </Link>
            <Link
              href={`/recalls?car=${car.id}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "inline-flex rounded-xl",
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
