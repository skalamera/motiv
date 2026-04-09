"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";

export type DashboardProfileGreeting = {
  displayName: string | null;
  avatarUrl: string | null;
};

function firstNameFromDisplay(displayName: string | null): string | null {
  const t = displayName?.trim();
  if (!t) return null;
  const first = t.split(/\s+/)[0];
  return first || null;
}
import type { CarWithMeta } from "@/lib/data/cars";
import { CarCard } from "@/components/dashboard/car-card";
import { StatCards } from "@/components/dashboard/stat-cards";
import { QuickAsk } from "@/components/dashboard/quick-ask";
import { RecentNews } from "@/components/dashboard/recent-news";
import { SuggestedLocalDrive } from "@/components/dashboard/suggested-local-drive";
import { DashboardVideosTeaser } from "@/components/dashboard/dashboard-videos-teaser";
import {
  useDashboardCrewData,
  DashboardCrewPendingAlerts,
  DashboardCrewUpcomingEvents,
} from "@/components/dashboard/dashboard-crew";
import { DashboardClassicMarket } from "@/components/dashboard/dashboard-classic-market";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardHome({
  data,
  profileGreeting,
}: {
  data: CarWithMeta[];
  profileGreeting: DashboardProfileGreeting;
}) {
  const crew = useDashboardCrewData();
  const showAvatar = Boolean(profileGreeting.avatarUrl?.trim());
  const first = firstNameFromDisplay(profileGreeting.displayName);
  const title =
    showAvatar && first
      ? `Hey, ${first}`
      : showAvatar
        ? "Hey there"
        : "Dashboard";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-1 flex items-center gap-3">
          {showAvatar ? (
            <div className="border-border/50 relative size-10 shrink-0 overflow-hidden rounded-full border bg-muted shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL */}
              <img
                src={profileGreeting.avatarUrl!}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div className="ai-gradient flex size-8 shrink-0 items-center justify-center rounded-lg text-white">
              <Sparkles className="size-4" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Your home base for vehicles, maintenance and recalls, a scenic drive
          nearby, automotive news, and Ask Motiv — all in one place.
        </p>
      </motion.div>

      <DashboardCrewPendingAlerts crew={crew} />

      {data.length > 0 ? <StatCards data={data} /> : null}
      {data.length > 0 ? <DashboardClassicMarket cars={data} /> : null}

      {data.length === 0 ? (
        <>
          {/* ── Suggested local drive ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <SuggestedLocalDrive />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <DashboardVideosTeaser />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="gradient-border rounded-2xl border border-dashed border-border/50 bg-card/30 p-12 text-center backdrop-blur-sm"
          >
            <div className="ai-gradient mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl text-white shadow-lg">
              <Plus className="size-6" />
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              You haven&apos;t added a vehicle yet. Start by adding your car and
              optional owner&apos;s manual PDF.
            </p>
            <Link
              href="/garage"
              className={cn(
                buttonVariants(),
                "ai-gradient glow-primary rounded-xl border-0 text-white hover:opacity-90",
              )}
            >
              Add your first car
            </Link>
          </motion.div>
        </>
      ) : (
        <>
          {/* ── Two-column: cars + ask motiv ── */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <DashboardCrewUpcomingEvents crew={crew} />
              
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">
                  Your vehicles
                </h2>
                <Link
                  href="/garage"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "rounded-xl text-xs text-muted-foreground",
                  )}
                >
                  <Plus className="mr-1 size-3" />
                  Add car
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {data.map((row, i) => (
                  <CarCard
                    key={row.car.id}
                    car={row.car}
                    schedules={row.schedules}
                    logs={row.logs}
                    recallCount={row.recallCount}
                    index={i}
                  />
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <QuickAsk />
            </div>
          </div>

          {/* ── Suggested local drive (above manufacturer news) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <SuggestedLocalDrive />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
          >
            <DashboardVideosTeaser />
          </motion.div>

          <RecentNews />
        </>
      )}
    </div>
  );
}
