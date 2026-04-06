"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { scenicDriveGoogleMapsUrl } from "@/lib/local-drives/maps-url";
import type { LocalDrivesResponse, ScenicDrive } from "@/types/local-drives";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, ExternalLink, ArrowRight } from "lucide-react";
import { ScenicDrivesMapPlaceholder } from "@/components/local-drives/scenic-drives-map";
import { getGoogleMapsApiKey } from "@/lib/maps-config";
import { cn } from "@/lib/utils";

const ScenicDrivesMap = dynamic(
  () =>
    import("@/components/local-drives/scenic-drives-map").then(
      (mod) => mod.ScenicDrivesMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border-border/50 bg-muted/20 flex h-[min(280px,40vh)] w-full items-center justify-center rounded-xl border md:h-[min(320px,38vh)]">
        <Loader2 className="text-muted-foreground size-7 animate-spin" />
      </div>
    ),
  },
);

const mapsKey = getGoogleMapsApiKey();
const SUGGESTED_DRIVE_CACHE_TTL_MS = 15 * 60 * 1000;
const SUGGESTED_DRIVE_CACHE_PREFIX = "suggested-local-drive:";

type SuggestedDriveCacheEntry = {
  savedAt: number;
  payload: LocalDrivesResponse;
};

function cacheKeyForAddress(address: string): string {
  return `${SUGGESTED_DRIVE_CACHE_PREFIX}${address.trim().toLowerCase()}`;
}

function readSuggestedDriveCache(address: string): LocalDrivesResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKeyForAddress(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuggestedDriveCacheEntry;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.savedAt !== "number" ||
      !parsed.payload
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > SUGGESTED_DRIVE_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKeyForAddress(address));
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeSuggestedDriveCache(address: string, payload: LocalDrivesResponse) {
  if (typeof window === "undefined") return;
  try {
    const entry: SuggestedDriveCacheEntry = {
      savedAt: Date.now(),
      payload,
    };
    window.sessionStorage.setItem(cacheKeyForAddress(address), JSON.stringify(entry));
  } catch {
    // Ignore storage errors (private mode/quota); app still works without cache.
  }
}

export function SuggestedLocalDrive() {
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [data, setData] = useState<LocalDrivesResponse | null>(null);
  const [drive, setDrive] = useState<ScenicDrive | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("location_address")
      .eq("id", user.id)
      .maybeSingle();
    const addr = (prof as { location_address?: string | null } | null)
      ?.location_address?.trim();
    setSavedAddress(addr ?? null);
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profileLoaded || !savedAddress) return;
    const address = savedAddress;

    let cancelled = false;

    const cached = readSuggestedDriveCache(address);
    if (cached) {
      setError(null);
      setData(cached);
      setDrive(cached.drives[0] ?? null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/local-drives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview: true }),
        });
        const body = (await res.json()) as
          | LocalDrivesResponse
          | { error?: string; code?: string };
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            typeof body === "object" && body && "error" in body && body.error
              ? String(body.error)
              : "Could not load a suggested drive";
          setError(msg);
          setData(null);
          setDrive(null);
          return;
        }
        const payload = body as LocalDrivesResponse;
        setData(payload);
        setDrive(payload.drives[0] ?? null);
        writeSuggestedDriveCache(address, payload);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Request failed");
          setData(null);
          setDrive(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [profileLoaded, savedAddress]);

  const showMap = Boolean(mapsKey && drive?.waypoints?.length);

  if (!profileLoaded) {
    return (
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading nearby drives…
        </CardContent>
      </Card>
    );
  }

  if (!savedAddress) {
    return (
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4" />
            Local scenic drives
          </CardTitle>
          <CardDescription>
            Add your address in Settings to see map-ready route ideas near you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/settings" className={buttonVariants({ size: "sm" })}>
            Add location
          </Link>
          <Link
            href="/local-drives"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Local Drives
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="Suggested local drive">
      <Card className="border-border/50 overflow-hidden bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Suggested drive near you</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {savedAddress}
              </CardDescription>
            </div>
            <Link
              href="/local-drives"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "ai-gradient shrink-0 gap-1.5 border-0 text-white shadow-sm hover:opacity-95",
              )}
            >
              View all local drives
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Finding a scenic route…
            </div>
          ) : error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && drive && data ? (
            <>
              {showMap ? (
                <ScenicDrivesMap
                  apiKey={mapsKey}
                  mapCenter={data.mapCenter}
                  drives={[drive]}
                  selectedIndex={0}
                  onSelectDrive={() => {}}
                />
              ) : (
                <ScenicDrivesMapPlaceholder className="h-[min(280px,40vh)] md:h-[min(320px,38vh)]" />
              )}

              <div>
                <h3 className="text-base font-semibold">{drive.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  About {drive.estimatedDurationMinutes} min · route starts and
                  ends at your saved address in Google Maps
                </p>
                <p className="mt-2 text-sm">{drive.description}</p>
              </div>

              {drive.waypoints.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Legs &amp; stops
                  </p>
                  <ol className="border-border/50 divide-border/50 list-inside list-decimal divide-y rounded-xl border text-sm">
                    {drive.waypoints.map((w, wi) => (
                      <li
                        key={`${w.label}-${wi}`}
                        className="px-3 py-2.5 [&::marker]:font-semibold"
                      >
                        <span className="text-foreground font-medium">
                          {w.label}
                        </span>
                        {w.placeQuery && w.placeQuery !== w.label ? (
                          <span className="text-muted-foreground mt-0.5 block pl-5 text-xs">
                            {w.placeQuery}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={scenicDriveGoogleMapsUrl(drive, data.locationAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Open in Google Maps
                </a>
                <Link
                  href="/local-drives"
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  More drives &amp; refresh
                </Link>
              </div>
            </>
          ) : null}

          {!loading && !error && !drive && profileLoaded && savedAddress ? (
            <p className="text-muted-foreground text-sm">
              No route returned.{" "}
              <Link href="/local-drives" className="text-primary underline">
                Try Local Drives
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
