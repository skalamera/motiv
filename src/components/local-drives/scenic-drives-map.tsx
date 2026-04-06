"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import type { ScenicDrive } from "@/types/local-drives";
import { MapsLoadFailureCard } from "@/components/local-drives/maps-setup-help";
import { cn } from "@/lib/utils";

const ROUTE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#ef4444",
];

function FitBounds({ drives }: { drives: ScenicDrive[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || drives.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const d of drives) {
      for (const w of d.waypoints) {
        bounds.extend(w);
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 56, right: 48, bottom: 48, left: 48 });
    }
  }, [map, drives]);

  return null;
}

export type ScenicDrivesMapProps = {
  apiKey: string;
  mapCenter: { lat: number; lng: number };
  drives: ScenicDrive[];
  selectedIndex: number | null;
  onSelectDrive: (index: number | null) => void;
};

export function ScenicDrivesMap({
  apiKey,
  mapCenter,
  drives,
  selectedIndex,
  onSelectDrive,
}: ScenicDrivesMapProps) {
  const defaultZoom = 9;
  const [mapsFailed, setMapsFailed] = useState(false);

  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    w.gm_authFailure = () => setMapsFailed(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  const markerMeta = useMemo(() => {
    const list: {
      driveIndex: number;
      wpIndex: number;
      label: string;
      placeQuery?: string;
      position: google.maps.LatLngLiteral;
    }[] = [];
    drives.forEach((d, di) => {
      d.waypoints.forEach((w, wi) => {
        list.push({
          driveIndex: di,
          wpIndex: wi,
          label: w.label,
          placeQuery: w.placeQuery,
          position: { lat: w.lat, lng: w.lng },
        });
      });
    });
    return list;
  }, [drives]);

  if (mapsFailed) {
    return (
      <div className="space-y-3">
        <MapsLoadFailureCard />
        <div
          className="border-border/50 bg-muted/20 text-muted-foreground flex h-[min(200px,25vh)] w-full items-center justify-center rounded-xl border border-dashed text-center text-xs"
          aria-hidden
        >
          Map hidden until the API key is fixed.
        </div>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      onError={() => setMapsFailed(true)}
    >
      <div className="border-border/50 relative h-[min(420px,55vh)] w-full overflow-hidden rounded-xl border md:h-[min(480px,50vh)]">
        <Map
          defaultCenter={mapCenter}
          defaultZoom={defaultZoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          className="size-full"
        >
          <FitBounds drives={drives} />
          {drives.map((drive, di) => {
            const path = drive.waypoints.map((w) => ({
              lat: w.lat,
              lng: w.lng,
            }));
            const color = ROUTE_COLORS[di % ROUTE_COLORS.length];
            const selected = selectedIndex === di;
            return (
              <Polyline
                key={`route-${di}`}
                path={path}
                strokeColor={color}
                strokeOpacity={selected ? 0.95 : 0.55}
                strokeWeight={selected ? 5 : 3}
                onClick={() => onSelectDrive(di)}
              />
            );
          })}
          {markerMeta.map((m, i) => (
            <Marker
              key={`m-${m.driveIndex}-${m.wpIndex}-${i}`}
              position={m.position}
              title={`${m.label}${m.placeQuery ? ` — ${m.placeQuery}` : ""}`}
              onClick={() => onSelectDrive(m.driveIndex)}
            />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}

export function ScenicDrivesMapPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-muted/30 text-muted-foreground flex min-h-[min(420px,55vh)] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 md:min-h-[min(480px,50vh)]",
        className,
      )}
    >
      <p className="max-w-sm text-center text-sm">
        Set{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-xs">
          GOOGLE_MAPS_API
        </code>{" "}
        in the environment and redeploy. Drives still appear below.
      </p>
      <p className="max-w-md text-center text-xs opacity-90">
        If the key is set but the map shows an error, enable billing and the Maps
        JavaScript API in Google Cloud, and allow your site URL as an HTTP referrer.
      </p>
    </div>
  );
}
