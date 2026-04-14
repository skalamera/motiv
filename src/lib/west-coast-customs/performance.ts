import type { Part, PerformanceStats, CarBaseStats } from "./types";
import { getPartPrice } from "./parts-registry";

const DEFAULT_BASE: PerformanceStats = {
  hp: 300,
  torque: 300,
  weight: 3500,
  zeroToSixty: 5.5,
  quarterMile: 13.8,
  quarterMileSpeed: 102,
};

export function getBaseStats(
  carBaseStats: CarBaseStats | null,
): PerformanceStats {
  if (!carBaseStats) return { ...DEFAULT_BASE };
  return { ...carBaseStats };
}

export function calculateStats(
  base: PerformanceStats,
  parts: Part[],
): PerformanceStats {
  const hpGain = parts.reduce((sum, p) => sum + (p.hpGain ?? 0), 0);
  const torqueGain = parts.reduce((sum, p) => sum + (p.torqueGain ?? 0), 0);

  const hp = base.hp + hpGain;
  const torque = base.torque + torqueGain;
  const weight = base.weight; // Weight unchanged — PDF data doesn't include weight deltas

  // 0-60: scale from base using power-to-weight ratio
  const zeroToSixty = Math.max(
    1.5,
    base.zeroToSixty * (base.hp / hp) * (weight / base.weight),
  );

  // Brock Yates 1/4 mile approximation
  const quarterMile = 5.825 * Math.pow(weight / hp, 1 / 3);

  // 1/4 mile trap speed
  const quarterMileSpeed = 234 * Math.pow(hp / weight, 1 / 3);

  return {
    hp: Math.round(hp),
    torque: Math.round(torque),
    weight: Math.round(weight),
    zeroToSixty: Math.round(zeroToSixty * 100) / 100,
    quarterMile: Math.round(quarterMile * 100) / 100,
    quarterMileSpeed: Math.round(quarterMileSpeed * 10) / 10,
  };
}

export function totalPartsCost(parts: Part[]): number {
  return parts.reduce((sum, p) => sum + getPartPrice(p), 0);
}
