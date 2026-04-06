import type { ScenicDrive } from "@/types/local-drives";

function stopQuery(w: {
  placeQuery?: string | null;
  label: string;
}): string {
  return (w.placeQuery?.trim() || w.label.trim()).replace(/\n/g, " ");
}

/**
 * Round-trip directions: always start and end at the user's profile address.
 * Intermediate legs use named places (placeQuery), not coordinates.
 */
export function scenicDriveGoogleMapsUrl(
  drive: ScenicDrive,
  homeAddress: string,
): string {
  const home = homeAddress.trim().replace(/\n/g, " ");
  const stops = drive.waypoints.map(stopQuery).filter(Boolean);

  if (!home) {
    if (stops.length === 0) return "https://www.google.com/maps";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0]!)}`;
  }

  if (stops.length === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(home)}`;
  }

  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("origin", home);
  params.set("destination", home);
  params.set("waypoints", stops.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
