"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import type {
  Build,
  BuildState,
  CarPartsConfig,
  PartOptionsMap,
} from "@/lib/west-coast-customs/types";
import {
  getCarConfig,
  getPartsByIds,
  getPartPrice,
} from "@/lib/west-coast-customs/parts-registry";
import {
  calculateStats,
  getBaseStats,
  totalPartsCost,
} from "@/lib/west-coast-customs/performance";
import { BuildHero } from "./build-hero";
import { PartsBrowser } from "./parts-browser";
import { BuildSummary } from "./build-summary";
import { PerformanceCompare } from "./performance-compare";
import { MockupViewer } from "./mockup-viewer";
import { SavedBuildsDialog } from "./saved-builds-dialog";
import { cn } from "@/lib/utils";

function storageKey(carId: string): string {
  return `wcc-builds:${carId}`;
}
function loadBuilds(carId: string): Build[] {
  try {
    const raw = window.localStorage.getItem(storageKey(carId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Build[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function persistBuilds(carId: string, builds: Build[]) {
  try {
    window.localStorage.setItem(storageKey(carId), JSON.stringify(builds));
  } catch {}
}

type Tab = "parts" | "stats" | "mockup";

export function WccView() {
  const { theme, setTheme } = useTheme();
  const prevThemeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    prevThemeRef.current = theme;
    if (theme !== "dark") setTheme("dark");
    return () => {
      if (prevThemeRef.current && prevThemeRef.current !== "dark") {
        setTheme(prevThemeRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [carId, setCarId] = useState<string | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [carConfig, setCarConfig] = useState<CarPartsConfig | null>(null);
  const [baseImageUrl, setBaseImageUrl] = useState<string | null>(null);
  const [baseImageSource, setBaseImageSource] =
    useState<BuildState["baseImageSource"]>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [partOptions, setPartOptions] = useState<PartOptionsMap>({});
  const [mockupImageUrl, setMockupImageUrl] = useState<string | null>(null);
  const [mockupRearImageUrl, setMockupRearImageUrl] = useState<string | null>(
    null,
  );
  const [savedBuilds, setSavedBuilds] = useState<Build[]>([]);
  const [generatingStock, setGeneratingStock] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("parts");
  const hydrated = useRef(false);

  // Fetch car from Supabase + resolve config
  useEffect(() => {
    if (!carId) {
      setCar(null);
      setCarConfig(null);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .eq("id", carId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const c = data as Car;
          setCar(c);
          setCarConfig(getCarConfig(c));
        }
      });
  }, [carId]);

  // Generate stock image if needed
  useEffect(() => {
    if (!carId || !car) return;
    if (car.image_url) {
      setBaseImageUrl(car.image_url);
      setBaseImageSource("profile");
      return;
    }
    let cancelled = false;
    setGeneratingStock(true);
    void fetch("/api/cars/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carId }),
    })
      .then((r) => r.json() as Promise<{ imageUrl?: string }>)
      .then((d) => {
        if (!cancelled && d.imageUrl) {
          setBaseImageUrl(d.imageUrl);
          setBaseImageSource("generated");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGeneratingStock(false);
      });
    return () => {
      cancelled = true;
    };
  }, [carId, car]);

  // Load/persist builds
  useEffect(() => {
    if (!carId) {
      setSavedBuilds([]);
      return;
    }
    hydrated.current = true;
    setSavedBuilds(loadBuilds(carId));
    window.setTimeout(() => {
      hydrated.current = false;
    }, 0);
  }, [carId]);
  useEffect(() => {
    if (hydrated.current || !carId) return;
    persistBuilds(carId, savedBuilds);
  }, [savedBuilds, carId]);

  // Derived state
  const selectedParts = useMemo(
    () => (carConfig ? getPartsByIds(carConfig, selectedPartIds) : []),
    [carConfig, selectedPartIds],
  );
  const baseStats = useMemo(
    () => getBaseStats(carConfig?.baseStats ?? null),
    [carConfig],
  );
  const modifiedStats = useMemo(
    () => calculateStats(baseStats, selectedParts),
    [baseStats, selectedParts],
  );
  const grandTotal = useMemo(() => totalPartsCost(selectedParts), [selectedParts]);

  // Handlers
  const handleCarChange = useCallback((id: string | null) => {
    setCarId(id);
    setBaseImageUrl(null);
    setBaseImageSource(null);
    setSelectedPartIds([]);
    setPartOptions({});
    setMockupImageUrl(null);
    setMockupRearImageUrl(null);
    setGeneratingStock(false);
  }, []);
  const handleImageSelected = useCallback(
    (url: string, source: BuildState["baseImageSource"]) => {
      setBaseImageUrl(url);
      setBaseImageSource(source);
      setMockupImageUrl(null);
      setMockupRearImageUrl(null);
    },
    [],
  );
  const handleTogglePart = useCallback(
    (partId: string) => {
      const part = carConfig?.parts.find((p) => p.id === partId);
      const isExclusive =
        part?.category === "tuning" || part?.category === "package";

      setSelectedPartIds((prev) => {
        if (prev.includes(partId)) return prev.filter((id) => id !== partId);

        let base = prev;
        if (part?.category === "package" && carConfig) {
          const tuningIds = new Set(
            carConfig.parts
              .filter((p) => p.category === "tuning")
              .map((p) => p.id),
          );
          base = prev.filter((id) => !tuningIds.has(id));
        }

        if (isExclusive && part && carConfig) {
          const siblings = carConfig.parts
            .filter((p) => p.category === part.category)
            .map((p) => p.id);
          return [...base.filter((id) => !siblings.includes(id)), partId];
        }
        return [...base, partId];
      });
      setMockupImageUrl(null);
      setMockupRearImageUrl(null);
    },
    [carConfig],
  );
  const handleOptionChange = useCallback(
    (partId: string, optionId: string) => {
      setPartOptions((prev) => ({ ...prev, [partId]: optionId }));
      setMockupImageUrl(null);
      setMockupRearImageUrl(null);
    },
    [],
  );
  const handleSaveBuild = useCallback(
    (name: string) => {
      if (!carId) return;
      setSavedBuilds((prev) => [
        {
          id: crypto.randomUUID(),
          carId,
          name,
          baseImageUrl,
          selectedPartIds,
          partOptions,
          mockupImageUrl,
          mockupRearImageUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ...prev,
      ]);
    },
    [
      carId,
      baseImageUrl,
      selectedPartIds,
      partOptions,
      mockupImageUrl,
      mockupRearImageUrl,
    ],
  );
  const handleLoadBuild = useCallback((build: Build) => {
    setSelectedPartIds(build.selectedPartIds);
    setPartOptions(build.partOptions ?? {});
    if (build.baseImageUrl) {
      setBaseImageUrl(build.baseImageUrl);
      setBaseImageSource("profile");
    }
    if (build.mockupImageUrl) setMockupImageUrl(build.mockupImageUrl);
    setMockupRearImageUrl(build.mockupRearImageUrl ?? null);
  }, []);
  const handleDeleteBuild = useCallback((buildId: string) => {
    setSavedBuilds((prev) => prev.filter((b) => b.id !== buildId));
  }, []);
  const handleReset = useCallback(() => {
    setSelectedPartIds([]);
    setPartOptions({});
    setMockupImageUrl(null);
    setMockupRearImageUrl(null);
  }, []);
  const handleMockupsGenerated = useCallback(
    (front: string, rear: string) => {
      setMockupImageUrl(front);
      setMockupRearImageUrl(rear);
    },
    [],
  );

  return (
    <div className="dark" style={{ colorScheme: "dark" }}>
      <div className="wcc-bg relative min-h-[100dvh] text-foreground">
        {/* ── GARAGE VIEW ── */}
        <BuildHero
          carId={carId}
          car={car}
          baseImageUrl={baseImageUrl}
          generatingStock={generatingStock}
          onCarChange={handleCarChange}
          onImageSelected={handleImageSelected}
        />

        {/* Saved builds button */}
        {carId && savedBuilds.length > 0 ? (
          <div className="absolute right-3 top-3 z-30">
            <SavedBuildsDialog
              builds={savedBuilds}
              onLoad={handleLoadBuild}
              onDelete={handleDeleteBuild}
            />
          </div>
        ) : null}

        {/* ── BOTTOM SECTION: tabs + content ── */}
        {carId ? (
          <div className="relative z-10">
            {/* Tab bar — game-style bottom nav */}
            <div className="sticky top-0 z-30 border-b border-[oklch(0.7_0.25_40_/_0.1)] bg-[oklch(0.06_0.015_270_/_0.9)] backdrop-blur-xl">
              {/* Floating cost tracker */}
              {selectedPartIds.length > 0 ? (
                <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Build Total
                    </span>
                    <span
                      className="wcc-neon-orange text-base font-black tabular-nums"
                      style={{ color: "oklch(0.7 0.25 40)" }}
                    >
                      ${grandTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="wcc-neon-cyan text-base font-black tabular-nums"
                      style={{ color: "oklch(0.7 0.2 200)" }}
                    >
                      {selectedPartIds.length}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Parts
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Tab buttons */}
              <div className="flex items-center justify-center gap-1 px-2 pb-2 pt-1">
                {(
                  [
                    { id: "parts" as Tab, label: "PARTS", icon: "🔧" },
                    { id: "stats" as Tab, label: "DYNO", icon: "📊" },
                    { id: "mockup" as Tab, label: "RENDER", icon: "🎬" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition-all",
                      activeTab === tab.id
                        ? "text-black"
                        : "text-muted-foreground active:scale-95",
                    )}
                  >
                    {activeTab === tab.id ? (
                      <div className="absolute inset-0 rounded-xl wcc-accent wcc-glow" />
                    ) : null}
                    <span className="relative z-10 text-base">{tab.icon}</span>
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-3 pb-6 pt-3 lg:px-6">
              {activeTab === "parts" ? (
                <div className="space-y-3">
                  {carConfig ? (
                    <PartsBrowser
                      carConfig={carConfig}
                      selectedPartIds={selectedPartIds}
                      partOptions={partOptions}
                      onTogglePart={handleTogglePart}
                      onOptionChange={handleOptionChange}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p
                        className="text-lg font-black uppercase tracking-wider"
                        style={{ color: "oklch(0.7 0.25 40)" }}
                      >
                        Coming Soon
                      </p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        Custom parts catalog not yet available for this car.
                        Check back soon for dedicated aftermarket parts.
                      </p>
                    </div>
                  )}
                  <BuildSummary
                    selectedParts={selectedParts}
                    totalCost={grandTotal}
                    onSave={handleSaveBuild}
                    onReset={handleReset}
                    canSave={selectedPartIds.length > 0}
                  />
                </div>
              ) : null}

              {activeTab === "stats" ? (
                <PerformanceCompare
                  base={baseStats}
                  modified={modifiedStats}
                  hasMods={selectedPartIds.length > 0}
                />
              ) : null}

              {activeTab === "mockup" ? (
                <MockupViewer
                  carId={carId}
                  car={car}
                  selectedParts={selectedParts}
                  partOptions={partOptions}
                  mockupImageUrl={mockupImageUrl}
                  mockupRearImageUrl={mockupRearImageUrl}
                  baseImageUrl={baseImageUrl}
                  onMockupsGenerated={handleMockupsGenerated}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
