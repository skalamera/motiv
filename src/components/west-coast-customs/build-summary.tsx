"use client";

import { useState } from "react";
import { RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Part } from "@/lib/west-coast-customs/types";
import { formatPartPrice } from "@/lib/west-coast-customs/parts-registry";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  selectedParts: Part[];
  totalCost: number;
  onSave: (name: string) => void;
  onReset: () => void;
  canSave: boolean;
};

export function BuildSummary({
  selectedParts,
  totalCost,
  onSave,
  onReset,
  canSave,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [buildName, setBuildName] = useState("");

  function handleSave() {
    onSave(buildName.trim() || `Build ${new Date().toLocaleDateString()}`);
    setBuildName("");
    setSaving(false);
  }

  if (selectedParts.length === 0) return null;

  return (
    <div className="wcc-hud rounded-xl p-3">
      {/* Parts list -- scrollable */}
      <div className="max-h-40 space-y-1 overflow-y-auto">
        <AnimatePresence>
          {selectedParts.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="min-w-0 flex-1">
                <span className="truncate text-white/80">{p.name}</span>
                <span className="ml-1 text-[9px] text-muted-foreground">
                  {p.brand}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatPartPrice(p)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Total */}
      <div className="mt-2 flex items-center justify-between border-t border-[oklch(0.7_0.25_40_/_0.15)] pt-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {selectedParts.length} part{selectedParts.length !== 1 ? "s" : ""}
        </span>
        <motion.span
          key={totalCost}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          className="text-sm font-black tabular-nums"
          style={{ color: "oklch(0.7 0.25 40)" }}
        >
          ${totalCost.toLocaleString()}
        </motion.span>
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-2">
        {saving ? (
          <div className="flex flex-1 gap-1.5">
            <input
              type="text"
              value={buildName}
              onChange={(e) => setBuildName(e.target.value)}
              placeholder="Build name..."
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[oklch(0.7_0.25_40_/_0.3)] bg-transparent px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setSaving(false);
              }}
            />
            <Button
              size="sm"
              className="wcc-accent rounded-lg border-0 text-black"
              onClick={handleSave}
            >
              <Save className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={() => setSaving(false)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              className="wcc-accent flex-1 rounded-lg border-0 text-xs font-bold uppercase tracking-wider text-black active:scale-95"
              disabled={!canSave}
              onClick={() => setSaving(true)}
            >
              <Save className="mr-1 size-3" /> Save Build
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg text-xs text-muted-foreground active:scale-95"
              onClick={onReset}
            >
              <RotateCcw className="mr-1 size-3" /> Reset
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
