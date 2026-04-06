/** Open Google Maps directions through each waypoint in order (best-effort scenic path). */
export function googleMapsDirectionsUrl(
  waypoints: { lat: number; lng: number }[],
): string {
  if (waypoints.length === 0) {
    return "https://www.google.com/maps";
  }
  if (waypoints.length === 1) {
    const { lat, lng } = waypoints[0];
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const segs = waypoints.map((w) => `${w.lat},${w.lng}`);
  return `https://www.google.com/maps/dir/${segs.join("/")}`;
}
