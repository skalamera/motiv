// ── Part categories matching the real aftermarket ecosystem ──
export type PartCategory =
  | "tuning"
  | "transmission"
  | "package"
  | "forced-induction"
  | "exhaust"
  | "intake"
  | "engine"
  | "fueling"
  | "cooling"
  | "drivetrain"
  | "brakes"
  | "exterior";

// Performance vs Aero vs Cosmetic — orthogonal to category
export type PartType = "Performance" | "Aero" | "Cosmetic";

export type PartOption = {
  id: string;
  label: string;
  /** Hex color for swatch display (colors only) */
  hex?: string;
};

export type Part = {
  id: string;
  category: PartCategory;
  type: PartType;
  name: string;
  brand: string;
  description: string;
  /** Fixed price or a range (display "From $min") */
  price: number | { min: number; max: number };
  hpGain: number | null;
  torqueGain: number | null;
  /** Qualitative spec string for parts without HP/TQ numbers */
  specs?: string;
  /** URL to the manufacturer's product page */
  productUrl?: string | null;
  /** Direct image URL for the part */
  imageUrl?: string | null;
  /** Prerequisite part IDs (e.g., Stage 2 tune requires headers) */
  requiresPartIds?: string[];
  /** Optional selectable options (color, size, etc.) */
  options?: { label: string; choices: PartOption[] };
};

export type PerformanceStats = {
  hp: number;
  torque: number;
  weight: number;
  zeroToSixty: number;
  quarterMile: number;
  quarterMileSpeed: number;
};

/** Maps partId -> selected option id */
export type PartOptionsMap = Record<string, string>;

export type Build = {
  id: string;
  carId: string;
  name: string;
  baseImageUrl: string | null;
  selectedPartIds: string[];
  partOptions: PartOptionsMap;
  mockupImageUrl: string | null;
  mockupRearImageUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

export type BuildState = {
  carId: string | null;
  baseImageUrl: string | null;
  baseImageSource: "profile" | "upload" | "generated" | null;
  selectedPartIds: string[];
  mockupImageUrl: string | null;
  savedBuilds: Build[];
};

// ── Car-specific configuration ──

export type CarBaseStats = {
  hp: number;
  torque: number;
  weight: number;
  zeroToSixty: number;
  quarterMile: number;
  quarterMileSpeed: number;
};

export type CarPartsConfig = {
  carKey: string;
  matchCriteria: {
    year?: number;
    make: string;
    model: string;
    trim?: string | null;
  };
  displayName: string;
  baseStats: CarBaseStats;
  categories: PartCategory[];
  parts: Part[];
};
