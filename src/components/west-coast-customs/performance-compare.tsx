"use client";

import { useEffect, useRef, useState } from "react";
import type { PerformanceStats } from "@/lib/west-coast-customs/types";
import { cn } from "@/lib/utils";

type Props = {
  base: PerformanceStats;
  modified: PerformanceStats;
  hasMods: boolean;
};

function AnimNum({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / 350, 1);
      setDisplay(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <>{format(display)}</>;
}

type Metric = {
  label: string;
  unit: string;
  baseVal: number;
  modVal: number;
  lowerIsBetter?: boolean;
  format: (v: number) => string;
  maxScale: number;
};

export function PerformanceCompare({ base, modified, hasMods }: Props) {
  const metrics: Metric[] = [
    { label: "HP", unit: "hp", baseVal: base.hp, modVal: modified.hp, format: (v) => Math.round(v).toString(), maxScale: 800 },
    { label: "TORQUE", unit: "lb-ft", baseVal: base.torque, modVal: modified.torque, format: (v) => Math.round(v).toString(), maxScale: 800 },
    { label: "WEIGHT", unit: "lbs", baseVal: base.weight, modVal: modified.weight, lowerIsBetter: true, format: (v) => Math.round(v).toLocaleString(), maxScale: 5000 },
    { label: "0-60", unit: "sec", baseVal: base.zeroToSixty, modVal: modified.zeroToSixty, lowerIsBetter: true, format: (v) => v.toFixed(2), maxScale: 8 },
    { label: "1/4 MILE", unit: "sec", baseVal: base.quarterMile, modVal: modified.quarterMile, lowerIsBetter: true, format: (v) => v.toFixed(2), maxScale: 16 },
    { label: "TRAP", unit: "mph", baseVal: base.quarterMileSpeed, modVal: modified.quarterMileSpeed, format: (v) => v.toFixed(1), maxScale: 180 },
  ];

  return (
    <div className="space-y-4">
      <h3
        className="wcc-neon-cyan text-center text-base font-black uppercase tracking-[0.2em]"
        style={{ color: "oklch(0.7 0.2 200)" }}
      >
        Dyno Results
      </h3>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {metrics.map((m) => {
          const diff = m.modVal - m.baseVal;
          const improved = m.lowerIsBetter ? diff < 0 : diff > 0;
          const worse = m.lowerIsBetter ? diff > 0 : diff < 0;
          const ratio = m.lowerIsBetter
            ? 1 - m.modVal / m.maxScale
            : m.modVal / m.maxScale;

          return (
            <div
              key={m.label}
              className="wcc-hud flex flex-col items-center gap-1.5 rounded-xl p-3"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {m.label}
              </p>

              {/* Gauge bar */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-[oklch(0.15_0.02_270)]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(Math.min(ratio * 100, 100), 3)}%`,
                    background: !hasMods
                      ? "oklch(0.35 0.02 270)"
                      : improved
                        ? "oklch(0.65 0.2 145)"
                        : worse
                          ? "oklch(0.65 0.2 25)"
                          : "oklch(0.35 0.02 270)",
                    boxShadow: hasMods && (improved || worse)
                      ? `0 0 8px ${improved ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.65 0.2 25 / 0.4)"}`
                      : "none",
                  }}
                />
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black tabular-nums leading-none">
                  <AnimNum value={m.modVal} format={m.format} />
                </span>
                <span className="text-[9px] text-muted-foreground">{m.unit}</span>
              </div>

              {/* Delta */}
              {hasMods && diff !== 0 ? (
                <span
                  className={cn(
                    "text-[10px] font-bold tabular-nums",
                    improved ? "text-green-400" : "text-red-400",
                  )}
                >
                  {diff > 0 ? "+" : ""}{m.format(diff)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
