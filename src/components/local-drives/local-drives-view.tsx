"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { scenicDriveGoogleMapsUrl } from "@/lib/local-drives/maps-url";
import type { LocalDrivesResponse } from "@/types/local-drives";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, RefreshCw, ExternalLink } from "lucide-react";
import { ScenicDrivesMapPlaceholder } from "./scenic-drives-map";
import { getGoogleMapsApiKey } from "@/lib/maps-config";
import { cn } from "@/lib/utils";

const ScenicDrivesMap = dynamic(
  () =>
    import("./scenic-drives-map").then((mod) => mod.ScenicDrivesMap),
  {
    ssr: false,
    loading: () => (
      <div className="border-border/50 bg-muted/20 flex h-[min(420px,55vh)] w-full items-center justify-center rounded-xl border md:h-[min(480px,50vh)]">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    ),
  },
);

const mapsKey = getGoogleMapsApiKey();

export function LocalDrivesView() {
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [data, setData] = useState<LocalDrivesResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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

  async function fetchDrives() {
    setLoading(true);
    setError(null);
    setSelectedIndex(null);
    try {
      const res = await fetch("/api/local-drives", { method: "POST" });
      const body = (await res.json()) as
        | LocalDrivesResponse
        | { error?: string; code?: string };
      if (!res.ok) {
        const msg =
          typeof body === "object" && body && "error" in body && body.error
            ? String(body.error)
            : "Something went wrong";
        setError(msg);
        setData(null);
        return;
      }
      setData(body as LocalDrivesResponse);
      await loadProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const showMap = Boolean(mapsKey && data?.drives?.length);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Local Drives</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Scenic route ideas near your saved address, from Motiv&apos;s AI. Verify
          roads and conditions before you go.
        </p>
      </div>

      {!profileLoaded ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : !savedAddress ? (
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" />
              Add your location first
            </CardTitle>
            <CardDescription>
              We use the address from Settings to anchor suggestions in the right
              region.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings" className={buttonVariants()}>
              Open Settings
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your area</CardTitle>
              <CardDescription className="font-mono text-xs">
                {savedAddress}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => void fetchDrives()} disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    {data ? (
                      <RefreshCw className="mr-2 size-4" />
                    ) : (
                      <MapPin className="mr-2 size-4" />
                    )}
                    {data ? "Refresh suggestions" : "Get scenic drive ideas"}
                  </>
                )}
              </Button>
              <Link
                href="/settings"
                className={buttonVariants({ variant: "outline" })}
              >
                Edit address
              </Link>
            </CardContent>
          </Card>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {data ? (
            <>
              {showMap ? (
                <ScenicDrivesMap
                  apiKey={mapsKey}
                  mapCenter={data.mapCenter}
                  drives={data.drives}
                  selectedIndex={selectedIndex}
                  onSelectDrive={setSelectedIndex}
                />
              ) : (
                <ScenicDrivesMapPlaceholder />
              )}

              <div className="text-muted-foreground space-y-1 text-xs">
                <p>
                  Tap a colored route on the map to highlight it. Map lines use
                  approximate coordinates; Open in Maps starts and ends at your saved
                  Settings address with named stops in between.
                </p>
                <p>
                  If the map shows a Google error or &quot;development only&quot; watermark,
                  the key needs billing, Maps JavaScript API enabled, and your domain
                  under API key HTTP referrer restrictions (see the in-app notice if the
                  map fails to load).
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Suggested drives</h2>
                {data.drives.map((drive, i) => (
                  <Card
                    key={`${drive.title}-${i}`}
                    className={cn(
                      "border border-border/50 bg-card/50 cursor-pointer backdrop-blur-sm transition-shadow",
                      selectedIndex === i && "ring-primary ring-2",
                    )}
                    onClick={() => setSelectedIndex(i)}
                  >
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{drive.title}</CardTitle>
                          <CardDescription>
                            About {drive.estimatedDurationMinutes} min ·{" "}
                            {drive.waypoints.length} waypoints
                          </CardDescription>
                        </div>
                        <a
                          href={scenicDriveGoogleMapsUrl(
                            drive,
                            data.locationAddress,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <ExternalLink className="mr-1.5 size-3.5" />
                          Open in Maps
                        </a>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>{drive.description}</p>
                      {drive.waypoints.length > 0 ? (
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                            Stops along the route
                          </p>
                          <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-xs">
                            {drive.waypoints.map((w, wi) => (
                              <li key={wi}>
                                <span className="text-foreground font-medium">
                                  {w.label}
                                </span>
                                {w.placeQuery && w.placeQuery !== w.label ? (
                                  <span className="block pl-5 text-[0.8rem] opacity-90">
                                    {w.placeQuery}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                      {drive.highlights.length > 0 ? (
                        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                          {drive.highlights.map((h, hi) => (
                            <li key={hi}>{h}</li>
                          ))}
                        </ul>
                      ) : null}
                      {drive.googleMapsDirectionsHint ? (
                        <p className="text-muted-foreground text-xs">
                          {drive.googleMapsDirectionsHint}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
