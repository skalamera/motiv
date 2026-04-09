import type { Car } from "@/types/database";

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function blob(c: Pick<Car, "model" | "trim">): string {
  return `${norm(c.model)} ${norm(c.trim)}`.trim();
}

/**
 * CLASSIC.com embed widgets keyed to known vehicles. Add entries as new embeds are issued.
 * Order: more specific rules before looser ones if a car could match multiple patterns.
 */
const ENTRIES: {
  widgetId: string;
  matches: (c: Car) => boolean;
}[] = [
  // 2018 Porsche 911 Carrera S
  {
    widgetId: "kZXPDPtOo9ocr9n",
    matches: (c) =>
      c.year === 2018 &&
      norm(c.make).includes("porsche") &&
      blob(c).includes("911") &&
      blob(c).includes("carrera"),
  },
  // 2003 Mercedes-Benz CL 600
  {
    widgetId: "qYL9Dmi8JZJIMD3",
    matches: (c) =>
      c.year === 2003 &&
      norm(c.make).includes("mercedes") &&
      blob(c).includes("cl") &&
      (blob(c).includes("600") || blob(c).includes("cl600")),
  },
  // 2013 Mercedes-Benz AMG C63 P31
  {
    widgetId: "yr2nMvsrAZAhnvW",
    matches: (c) => {
      const b = blob(c);
      return (
        c.year === 2013 &&
        norm(c.make).includes("mercedes") &&
        (b.includes("c63") || b.includes("c 63"))
      );
    },
  },
];

export type ResolvedClassicWidget = {
  carId: string;
  /** Shown in carousel chrome — uses the user’s car fields when possible */
  title: string;
  widgetId: string;
};

function carTitle(c: Car): string {
  const t = c.trim?.trim();
  return [c.year, c.make, c.model, t].filter(Boolean).join(" ");
}

export function resolveClassicWidgetsForCars(cars: Car[]): ResolvedClassicWidget[] {
  const out: ResolvedClassicWidget[] = [];
  for (const c of cars) {
    const entry = ENTRIES.find((e) => e.matches(c));
    if (!entry) continue;
    out.push({
      carId: c.id,
      title: carTitle(c),
      widgetId: entry.widgetId,
    });
  }
  return out;
}

export function classicWidgetEmbedUrl(widgetId: string): string {
  return `https://www.classic.com/widget/${widgetId}`;
}
