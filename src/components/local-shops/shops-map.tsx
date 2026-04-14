"use client";

import { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Shop } from "@/types/local-shops";

function FitBounds({ shops }: { shops: Shop[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || shops.length === 0) return;
    if (shops.length === 1) {
      map.setCenter({ lat: shops[0].lat, lng: shops[0].lng });
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const s of shops) {
      bounds.extend({ lat: s.lat, lng: s.lng });
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, right: 48, bottom: 48, left: 48 });
    }
  }, [map, shops]);
  return null;
}

type Props = {
  apiKey: string;
  shops: Shop[];
  selectedRank: number | null;
  onSelectShop: (rank: number) => void;
};

export function ShopsMap({ apiKey, shops, selectedRank, onSelectShop }: Props) {
  const [mapsFailed, setMapsFailed] = useState(false);

  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    w.gm_authFailure = () => setMapsFailed(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  if (mapsFailed) {
    return (
      <div className="border-border/50 bg-muted/20 text-muted-foreground flex h-64 w-full items-center justify-center rounded-xl border border-dashed text-center text-xs">
        Map unavailable — check Google Maps API key.
      </div>
    );
  }

  const center =
    shops.length > 0
      ? { lat: shops[0].lat, lng: shops[0].lng }
      : { lat: 38.9, lng: -77.0 };

  return (
    <APIProvider apiKey={apiKey} onError={() => setMapsFailed(true)}>
      <div className="border-border/50 relative h-[min(400px,50vh)] w-full overflow-hidden rounded-xl border">
        <Map
          defaultCenter={center}
          defaultZoom={10}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          colorScheme="DARK"
          className="size-full"
        >
          <FitBounds shops={shops} />
          {shops.map((shop) => {
            const isSelected = selectedRank === shop.rank;
            return (
              <Marker
                key={shop.rank}
                position={{ lat: shop.lat, lng: shop.lng }}
                title={`#${shop.rank} — ${shop.name}`}
                label={{
                  text: String(shop.rank),
                  color: isSelected ? "#000000" : "#ffffff",
                  fontWeight: "bold",
                  fontSize: "13px",
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 18 : 14,
                  fillColor: isSelected ? "#f97316" : "#1d4ed8",
                  fillOpacity: 1,
                  strokeColor: isSelected ? "#fff7ed" : "#93c5fd",
                  strokeWeight: 2,
                }}
                onClick={() => onSelectShop(shop.rank)}
                zIndex={isSelected ? 100 : shop.rank}
              />
            );
          })}
        </Map>

        {/* Legend */}
        <div className="bg-background/80 absolute bottom-3 left-3 flex items-center gap-3 rounded-lg px-2 py-1.5 text-[10px] backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-blue-600" />
            Shop
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-orange-500" />
            Selected
          </span>
        </div>
      </div>
    </APIProvider>
  );
}

export function ShopsMapPlaceholder() {
  return (
    <div className="border-border/50 bg-muted/10 text-muted-foreground flex h-64 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-xs">
      <p>Map loads after search results are returned.</p>
    </div>
  );
}
