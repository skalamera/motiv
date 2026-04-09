/**
 * Public Supabase object URLs are stable per path; after upserting a new file the URL
 * string is unchanged, so browsers/CDNs keep showing the old bytes. Store a version
 * query param so each update forces a fresh fetch.
 */
export function carImageUrlWithCacheBust(publicUrl: string): string {
  const u = publicUrl.trim();
  if (!u) return u;
  const base = u.split("?")[0] ?? u;
  return `${base}?v=${Date.now()}`;
}
