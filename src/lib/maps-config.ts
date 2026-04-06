/**
 * Google Maps JavaScript API key. Set `GOOGLE_MAPS_API` in `.env.local` / Vercel;
 * `next.config.ts` passes it into the client bundle.
 */
export function getGoogleMapsApiKey(): string {
  const k = process.env.GOOGLE_MAPS_API;
  return typeof k === "string" && k.trim() ? k.trim() : "";
}
