"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, LineChart } from "lucide-react";
import type { CarWithMeta } from "@/lib/data/cars";
import {
  classicWidgetEmbedUrl,
  resolveClassicWidgetsForCars,
} from "@/lib/classic-com-widgets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardClassicMarket({ cars }: { cars: CarWithMeta[] }) {
  const slides = resolveClassicWidgetsForCars(cars.map((r) => r.car));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((i) => (slides.length === 0 ? 0 : Math.min(i, slides.length - 1)));
  }, [slides.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (slides.length <= 1) return;
      setIndex((i) => (i + dir + slides.length) % slides.length);
    },
    [slides.length],
  );

  if (slides.length === 0) return null;

  const current = slides[index]!;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.35 }}
      aria-label="Classic car market trends"
      className="border-border/50 bg-card/40 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm"
    >
      <div className="border-border/40 flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl">
            <LineChart className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">
              Market trends
            </h2>
            <p className="text-muted-foreground text-xs leading-snug">
              Recent sales and asking prices from{" "}
              <a
                href="https://www.classic.com"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                CLASSIC.COM
              </a>
              {slides.length > 1 ? " — swipe or use arrows to switch vehicles." : "."}
            </p>
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => go(-1)}
              aria-label="Previous vehicle chart"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => go(1)}
              aria-label="Next vehicle chart"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="relative bg-muted/20">
        <p className="text-muted-foreground truncate px-4 pt-3 text-center text-xs font-medium sm:px-5">
          {current.title}
        </p>

        <div className="relative overflow-hidden px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.carId}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <iframe
                title={`CLASSIC.COM market data for ${current.title}`}
                src={classicWidgetEmbedUrl(current.widgetId)}
                className="bg-background block h-[min(450px,70vh)] w-full rounded-xl border-0 shadow-inner"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {slides.length > 1 ? (
          <div
            className="flex justify-center gap-1.5 px-4 pb-3"
            role="tablist"
            aria-label="Select vehicle chart"
          >
            {slides.map((s, i) => (
              <button
                key={s.carId}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show chart for ${s.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/45 w-1.5",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
