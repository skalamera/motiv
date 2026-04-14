import type { CarPartsConfig, CarBaseStats, Part, PartCategory } from "./types";
import { CAR_CONFIGS } from "./cars";

/**
 * Match a car from the database to a registered parts config.
 * Uses make (exact) + model (substring) matching.
 */
export function getCarConfig(car: {
  year?: number;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
} | null): CarPartsConfig | null {
  if (!car?.make || !car?.model) return null;

  const make = car.make.toLowerCase();
  const model = car.model.toLowerCase();

  let best: CarPartsConfig | null = null;
  let bestScore = 0;

  for (const config of CAR_CONFIGS) {
    const cm = config.matchCriteria;
    if (cm.make.toLowerCase() !== make) continue;
    if (!model.includes(cm.model.toLowerCase())) continue;

    let score = 1;
    if (cm.year && car.year && cm.year === car.year) score += 2;
    if (cm.trim && car.trim && car.trim.toLowerCase().includes(cm.trim.toLowerCase())) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = config;
    }
  }

  return best;
}

export function getBaseStatsForCar(car: {
  year?: number;
  make?: string;
  model?: string;
} | null): CarBaseStats | null {
  return getCarConfig(car)?.baseStats ?? null;
}

export function getPartsForCar(config: CarPartsConfig): Part[] {
  return config.parts;
}

export function getPartById(config: CarPartsConfig, partId: string): Part | undefined {
  return config.parts.find((p) => p.id === partId);
}

export function getPartsByCategory(config: CarPartsConfig, category: PartCategory): Part[] {
  return config.parts.filter((p) => p.category === category);
}

export function getPartsByIds(config: CarPartsConfig, ids: string[]): Part[] {
  const idSet = new Set(ids);
  return config.parts.filter((p) => idSet.has(p.id));
}

export function getCategoriesForCar(config: CarPartsConfig): PartCategory[] {
  return config.categories;
}

/** Resolve the display price (use min for ranges) */
export function getPartPrice(part: Part): number {
  return typeof part.price === "number" ? part.price : part.price.min;
}

/** Format price for display */
export function formatPartPrice(part: Part): string {
  if (typeof part.price === "number") {
    return `$${part.price.toLocaleString()}`;
  }
  return `From $${part.price.min.toLocaleString()}`;
}

/** Category metadata for UI display */
export const CATEGORY_META: Record<PartCategory, { label: string; icon: string }> = {
  tuning: { label: "ECU Tune", icon: "📟" },
  transmission: { label: "Transmission", icon: "🔀" },
  package: { label: "Packages", icon: "📦" },
  "forced-induction": { label: "Boost", icon: "🌀" },
  exhaust: { label: "Exhaust", icon: "💨" },
  intake: { label: "Intake", icon: "🌬️" },
  engine: { label: "Engine", icon: "🔩" },
  fueling: { label: "Fuel", icon: "⛽" },
  cooling: { label: "Cooling", icon: "❄️" },
  drivetrain: { label: "Drivetrain", icon: "⚙️" },
  brakes: { label: "Brakes", icon: "🛑" },
  exterior: { label: "Exterior", icon: "🏎️" },
};
