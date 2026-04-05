"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, MessageSquare, Wrench } from "lucide-react";
import type { CarWithMeta } from "@/lib/data/cars";
import { CarCard } from "@/components/dashboard/car-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardHome({ data }: { data: CarWithMeta[] }) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 max-w-lg text-sm">
            Your garage at a glance — maintenance, recalls, and AI guidance in
            one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/chat"
            className={cn(buttonVariants(), "inline-flex")}
          >
            <MessageSquare className="mr-2 size-4" />
            Ask Motiv
          </Link>
          <Link
            href="/maintenance"
            className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}
          >
            <Wrench className="mr-2 size-4" />
            Maintenance
          </Link>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
          >
            <Plus className="mr-2 size-4" />
            Add car
          </Link>
        </div>
      </motion.div>

      {data.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl border border-dashed border-white/15 p-12 text-center"
        >
          <p className="text-muted-foreground mb-4 text-sm">
            You haven&apos;t added a vehicle yet. Start by adding your car and
            optional owner&apos;s manual PDF.
          </p>
          <Link href="/settings" className={buttonVariants()}>
            Add your first car
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((row, i) => (
            <CarCard
              key={row.car.id}
              car={row.car}
              schedules={row.schedules}
              recallCount={row.recallCount}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
