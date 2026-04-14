"use client";

import { Check, ExternalLink, Plus } from "lucide-react";
import type { Part } from "@/lib/west-coast-customs/types";
import { formatPartPrice, getPartPrice } from "@/lib/west-coast-customs/parts-registry";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  part: Part;
  selected: boolean;
  selectedOptionId: string | undefined;
  onToggle: (partId: string) => void;
  onOptionChange: (partId: string, optionId: string) => void;
};

export function PartCard({
  part,
  selected,
  selectedOptionId,
  onToggle,
  onOptionChange,
}: Props) {
  const hasColors = part.options && part.options.choices.some((c) => c.hex);
  const isRange = typeof part.price !== "number";

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onToggle(part.id)}
        className={cn(
          "group relative flex items-start gap-3 p-3 text-left transition-all active:scale-[0.98]",
          selected
            ? "wcc-hud border-[oklch(0.7_0.25_40_/_0.4)] bg-[oklch(0.7_0.25_40_/_0.06)]"
            : "border border-[oklch(1_0_0_/_0.05)] bg-[oklch(0.1_0.02_270_/_0.6)] hover:border-[oklch(0.7_0.25_40_/_0.2)]",
          "rounded-xl",
          selected && part.options && "rounded-b-none border-b-0",
        )}
      >
        {/* Selection pip */}
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
            selected
              ? "bg-[oklch(0.7_0.25_40)] text-black shadow-[0_0_12px_oklch(0.7_0.25_40_/_0.4)]"
              : "border border-[oklch(1_0_0_/_0.1)] bg-[oklch(0.12_0.02_270)]",
          )}
        >
          {selected ? (
            <Check className="size-4" strokeWidth={3} />
          ) : (
            <Plus className="size-4 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug">{part.name}</p>
          <p className="text-[11px] font-semibold" style={{ color: "oklch(0.7 0.2 200)" }}>
            {part.brand}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
            {part.description}
          </p>
          {/* Specs badge for non-HP/TQ parts */}
          {part.specs && !part.hpGain && !part.torqueGain ? (
            <span className="mt-1 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {part.specs}
            </span>
          ) : null}
        </div>

        {/* Right side: cost + stats */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: "oklch(0.7 0.25 40)" }}
          >
            {formatPartPrice(part)}
          </span>
          {isRange ? (
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
              starting
            </span>
          ) : null}
          <div className="mt-0.5 flex flex-wrap justify-end gap-1">
            {part.hpGain ? (
              <span className="rounded bg-green-500/15 px-1 py-0.5 text-[9px] font-bold text-green-400">
                +{part.hpGain}hp
              </span>
            ) : null}
            {part.torqueGain ? (
              <span className="rounded bg-blue-500/15 px-1 py-0.5 text-[9px] font-bold text-blue-400">
                +{part.torqueGain}tq
              </span>
            ) : null}
          </div>
          {/* Product link */}
          {part.productUrl ? (
            <a
              href={part.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-white"
            >
              <ExternalLink className="size-2.5" />
              Shop
            </a>
          ) : null}
        </div>
      </button>

      {/* Options panel */}
      <AnimatePresence>
        {selected && part.options ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-b-xl border border-t-0 border-[oklch(0.7_0.25_40_/_0.4)] bg-[oklch(0.07_0.02_270_/_0.8)]"
          >
            <div className="px-3 py-2.5">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {part.options.label}
              </p>
              {hasColors ? (
                <div className="flex flex-wrap gap-2">
                  {part.options.choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => onOptionChange(part.id, c.id)}
                      className={cn(
                        "size-7 rounded-full border-2 transition-all active:scale-90",
                        selectedOptionId === c.id
                          ? "scale-110 border-white ring-2 ring-[oklch(0.7_0.25_40)] ring-offset-1 ring-offset-[oklch(0.07_0.02_270)]"
                          : "border-[oklch(1_0_0_/_0.1)] hover:scale-105 hover:border-white/40",
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {part.options.choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onOptionChange(part.id, c.id)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-bold transition-all active:scale-95",
                        selectedOptionId === c.id
                          ? "bg-[oklch(0.7_0.25_40)] text-black shadow-[0_0_8px_oklch(0.7_0.25_40_/_0.3)]"
                          : "bg-[oklch(0.12_0.02_270)] text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              {selectedOptionId ? (
                <p className="mt-1 text-[9px] text-[oklch(0.7_0.25_40)]">
                  {
                    part.options.choices.find((c) => c.id === selectedOptionId)
                      ?.label
                  }
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
