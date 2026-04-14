"use client";

import { useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Car } from "@/types/database";
import type { Part, PartOptionsMap } from "@/lib/west-coast-customs/types";
import { CATEGORY_META } from "@/lib/west-coast-customs/parts-registry";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  carId: string;
  car: Car | null;
  selectedParts: Part[];
  partOptions: PartOptionsMap;
  mockupImageUrl: string | null;
  mockupRearImageUrl: string | null;
  baseImageUrl: string | null;
  onMockupsGenerated: (front: string, rear: string) => void;
};

export function MockupViewer({
  carId,
  selectedParts,
  partOptions,
  mockupImageUrl,
  mockupRearImageUrl,
  baseImageUrl,
  onMockupsGenerated,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [activeAngle, setActiveAngle] = useState<"front" | "rear">("front");

  const currentImage =
    activeAngle === "front" ? mockupImageUrl : mockupRearImageUrl;
  const hasImages = mockupImageUrl && mockupRearImageUrl;

  async function generate() {
    if (generating || selectedParts.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/west-coast-customs/generate-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          selectedParts: selectedParts.map((p) => {
            const optId = partOptions[p.id];
            const choice = optId
              ? p.options?.choices.find((c) => c.id === optId)
              : undefined;
            return {
              category: CATEGORY_META[p.category]?.label ?? p.category,
              name: p.name,
              brand: p.brand,
              description: p.description,
              selectedOption: choice
                ? `${p.options?.label}: ${choice.label}`
                : undefined,
              imageUrl: p.imageUrl ?? undefined,
              productUrl: p.productUrl ?? undefined,
            };
          }),
        }),
      });
      const data = (await res.json()) as {
        frontImageUrl?: string;
        rearImageUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.frontImageUrl || !data.rearImageUrl)
        throw new Error(data.error ?? "Failed");
      onMockupsGenerated(data.frontImageUrl, data.rearImageUrl);
      setActiveAngle("front");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3
        className="wcc-neon-orange text-center text-base font-black uppercase tracking-[0.2em]"
        style={{ color: "oklch(0.7 0.25 40)" }}
      >
        AI Render
      </h3>

      {/* Angle tabs */}
      {hasImages ? (
        <div className="flex justify-center gap-1">
          {(["front", "rear"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveAngle(a)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                activeAngle === a
                  ? "bg-[oklch(0.7_0.25_40)] text-black shadow-[0_0_10px_oklch(0.7_0.25_40_/_0.3)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a === "front" ? "Front 3/4" : "Rear 3/4"}
            </button>
          ))}
        </div>
      ) : null}

      {/* Image */}
      <div className="wcc-scanlines relative aspect-video overflow-hidden rounded-xl border border-[oklch(0.7_0.25_40_/_0.1)] lg:aspect-[16/9] lg:min-h-[420px]">
        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex size-full flex-col items-center justify-center gap-3"
            >
              <Skeleton className="absolute inset-0" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <Loader2
                  className="size-10 animate-spin"
                  style={{ color: "oklch(0.7 0.25 40)" }}
                />
                <p className="ai-thinking text-xs uppercase tracking-widest text-muted-foreground">
                  Rendering build...
                </p>
              </div>
            </motion.div>
          ) : currentImage ? (
            <motion.div
              key={`mockup-${activeAngle}`}
              initial={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="relative size-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={showBefore && baseImageUrl ? baseImageUrl : currentImage}
                alt={`Mockup — ${activeAngle}`}
                className="size-full object-cover"
              />
              {baseImageUrl ? (
                <button
                  type="button"
                  className="absolute bottom-2 left-2 wcc-hud rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/80"
                  onPointerDown={() => setShowBefore(true)}
                  onPointerUp={() => setShowBefore(false)}
                  onPointerLeave={() => setShowBefore(false)}
                >
                  {showBefore ? "Stock" : "Hold → Stock"}
                </button>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground"
            >
              <Sparkles className="size-10 opacity-20" />
              <p className="text-xs uppercase tracking-widest">
                {selectedParts.length === 0
                  ? "Add parts first"
                  : "Ready to render"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate CTA */}
      <Button
        size="lg"
        className={cn(
          "w-full rounded-xl border-0 text-sm font-black uppercase tracking-wider text-black active:scale-[0.97]",
          hasImages ? "" : "wcc-pulse-border",
        )}
        style={{
          background:
            "linear-gradient(135deg, oklch(0.7 0.25 40), oklch(0.65 0.2 20))",
          boxShadow:
            "0 0 20px -4px oklch(0.7 0.25 40 / 0.4), 0 0 40px -8px oklch(0.7 0.25 40 / 0.2)",
        }}
        disabled={generating || selectedParts.length === 0}
        onClick={() => void generate()}
      >
        {generating ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : hasImages ? (
          <RefreshCw className="mr-2 size-4" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        {generating
          ? "Rendering..."
          : hasImages
            ? "Re-Render"
            : "Render My Build"}
      </Button>

      {error ? (
        <p className="text-center text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
