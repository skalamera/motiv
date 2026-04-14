"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  getPartsByCategory,
} from "@/lib/west-coast-customs/parts-registry";
import type {
  CarPartsConfig,
  PartCategory,
  PartOptionsMap,
  PartType,
} from "@/lib/west-coast-customs/types";
import { PartCard } from "./part-card";

type Props = {
  carConfig: CarPartsConfig;
  selectedPartIds: string[];
  partOptions: PartOptionsMap;
  onTogglePart: (partId: string) => void;
  onOptionChange: (partId: string, optionId: string) => void;
};

const TYPE_FILTERS: { id: PartType | null; label: string }[] = [
  { id: null, label: "All" },
  { id: "Performance", label: "Perf" },
  { id: "Aero", label: "Aero" },
  { id: "Cosmetic", label: "Cosmetic" },
];

export function PartsBrowser({
  carConfig,
  selectedPartIds,
  partOptions,
  onTogglePart,
  onOptionChange,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<PartCategory>(
    carConfig.categories[0],
  );
  const [activeType, setActiveType] = useState<PartType | null>(null);
  const selectedSet = new Set(selectedPartIds);

  const categoryParts = getPartsByCategory(carConfig, activeCategory);
  const parts = activeType
    ? categoryParts.filter((p) => p.type === activeType)
    : categoryParts;

  // Only show type filter when the exterior category has mixed types
  const hasMultipleTypes =
    activeCategory === "exterior" &&
    new Set(categoryParts.map((p) => p.type)).size > 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Category ribbon -- horizontal scroll, game menu style */}
      <div className="wcc-scroll-hide -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:-mx-6 lg:px-6">
        {carConfig.categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCategory(cat);
                setActiveType(null);
              }}
              className={cn(
                "relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all active:scale-95",
                isActive ? "text-black" : "text-muted-foreground",
              )}
            >
              {isActive ? (
                <motion.div
                  layoutId="wcc-cat"
                  className="absolute inset-0 rounded-xl wcc-accent"
                  transition={{
                    type: "spring",
                    bounce: 0.15,
                    duration: 0.35,
                  }}
                />
              ) : null}
              <span className="relative z-10 text-lg leading-none">
                {meta.icon}
              </span>
              <span className="relative z-10 text-[10px] font-bold uppercase tracking-wider">
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Type filter pills -- only show for exterior */}
      {hasMultipleTypes ? (
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() =>
                setActiveType(activeType === f.id ? null : f.id)
              }
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                activeType === f.id
                  ? "border-[oklch(0.7_0.2_200)] bg-[oklch(0.7_0.2_200_/_0.1)] text-[oklch(0.7_0.2_200)]"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Parts grid -- 1 col mobile, 2 col lg */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeCategory + (activeType ?? "")}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="grid grid-cols-1 gap-2.5 lg:grid-cols-2"
        >
          {parts.map((part, i) => (
            <motion.div
              key={part.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <PartCard
                part={part}
                selected={selectedSet.has(part.id)}
                selectedOptionId={partOptions[part.id]}
                onToggle={onTogglePart}
                onOptionChange={onOptionChange}
              />
            </motion.div>
          ))}
          {parts.length === 0 ? (
            <p className="col-span-full py-8 text-center text-xs uppercase tracking-widest text-muted-foreground">
              No parts for this filter
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
