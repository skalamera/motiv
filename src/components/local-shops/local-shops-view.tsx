"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Building2, AlertCircle, Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CarSelector } from "@/components/car-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShopCard } from "./shop-card";
import { ShopsMap, ShopsMapPlaceholder } from "./shops-map";
import type { Shop, ShopSearchResult } from "@/types/local-shops";

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API ?? "";

export function LocalShopsView() {
  const [carId, setCarId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShopSearchResult | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Pre-fill address from profile
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from("profiles")
        .select("location_address")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.location_address) setAddress(data.location_address);
        });
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!carId || !address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedRank(null);

    try {
      const res = await fetch("/api/local-shops/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, address: address.trim() }),
      });
      const data = (await res.json()) as ShopSearchResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Search failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [carId, address]);

  const handleSelectShop = useCallback((rank: number) => {
    setSelectedRank(rank);
    const el = cardRefs.current[rank];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const shops = (result?.shops ?? []) as Shop[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h1 className="text-xl font-bold">Local Shops</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Find the best independent specialists for your car near you, ranked by
          the Volume of Confidence algorithm.
        </p>
      </div>

      {/* Search controls */}
      <div className="bg-card border-border/50 space-y-3 rounded-xl border p-4">
        <CarSelector
          value={carId}
          onChange={setCarId}
          label="Select a vehicle"
        />

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Your Address
          </label>
          <div className="relative">
            <MapPin className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Annapolis, MD 21401"
              className="pl-9"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pre-filled from your profile. Edit to search a different area.
          </p>
        </div>

        <Button
          className="w-full"
          disabled={!carId || !address.trim() || loading}
          onClick={() => void handleSearch()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Searching… this may take 20–30 seconds
            </>
          ) : (
            <>
              <Search className="mr-2 size-4" />
              Find Shops
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error ? (
        <div className="bg-destructive/10 border-destructive/30 flex items-start gap-2 rounded-xl border p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Results */}
      {result && shops.length > 0 ? (
        <div className="space-y-5">
          {/* Meta */}
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">
              {shops.length} shops found for{" "}
              <span className="text-primary">{result.car}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Within 50 miles of {result.userAddress} · ranked by Volume of
              Confidence score
            </p>
          </div>

          {/* Map */}
          {MAPS_API_KEY ? (
            <ShopsMap
              apiKey={MAPS_API_KEY}
              shops={shops}
              selectedRank={selectedRank}
              onSelectShop={handleSelectShop}
            />
          ) : (
            <ShopsMapPlaceholder />
          )}

          {/* Shop cards */}
          <div className="space-y-4">
            {shops.map((shop) => (
              <div
                key={shop.rank}
                ref={(el) => {
                  cardRefs.current[shop.rank] = el;
                }}
              >
                <ShopCard
                  shop={shop}
                  selected={selectedRank === shop.rank}
                  onClick={() => handleSelectShop(shop.rank)}
                />
              </div>
            ))}
          </div>

          {/* Summary table */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold">Strategy Comparison</h2>
            <div className="border-border/50 overflow-hidden rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    {["Shop", "Best For", "Commute", "Specialist Capability"].map(
                      (h) => (
                        <th
                          key={h}
                          className="border-border/40 border-b px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop, i) => (
                    <tr
                      key={shop.rank}
                      className={`cursor-pointer transition-colors ${
                        selectedRank === shop.rank
                          ? "bg-orange-500/8"
                          : i % 2 === 0
                            ? "bg-transparent"
                            : "bg-muted/20"
                      } hover:bg-muted/30`}
                      onClick={() => handleSelectShop(shop.rank)}
                    >
                      <td className="border-border/40 border-b px-3 py-2.5">
                        <span className="font-semibold">#{shop.rank}</span>{" "}
                        {shop.name}
                      </td>
                      <td className="border-border/40 border-b px-3 py-2.5 text-muted-foreground">
                        {shop.bestFor}
                      </td>
                      <td className="border-border/40 border-b px-3 py-2.5 text-muted-foreground">
                        {shop.commuteDifficulty}
                      </td>
                      <td className="border-border/40 border-b px-3 py-2.5 text-muted-foreground">
                        {shop.specialistCapability}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {result && shops.length === 0 && !loading ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
          <Building2 className="size-10 opacity-20" />
          <p className="text-sm">
            No shops found within 50 miles. Try a different address or vehicle.
          </p>
        </div>
      ) : null}
    </div>
  );
}
