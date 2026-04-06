/**
 * YouTube playlist embeds keyed by vehicle manufacturer (car.make).
 * Extend this list as you add more brands.
 */
export type ManufacturerPlaylist = {
  /** Stable id for React keys */
  id: string;
  /** Section heading */
  displayName: string;
  /** YouTube playlist ID for videoseries embed */
  listId: string;
  /** Return true if this row applies to the given make string */
  matchesMake: (makeNormalized: string) => boolean;
};

function norm(make: string): string {
  return make.trim().toLowerCase().replace(/\s+/g, " ");
}

export const MANUFACTURER_PLAYLISTS: ManufacturerPlaylist[] = [
  {
    id: "porsche",
    displayName: "Porsche",
    listId: "PLKduzfEGbn-G6wOiOGperX3oWdMSs7lqp",
    matchesMake: (m) => m.includes("porsche"),
  },
  {
    id: "mercedes",
    displayName: "Mercedes-Benz",
    listId: "PLKgHYmJ8Qq3L__W2rquuEf4H58eoBukig",
    matchesMake: (m) =>
      m.includes("mercedes") || m.includes("mercedes-benz") || m === "mb",
  },
];

export function playlistEmbedSrc(listId: string): string {
  const params = new URLSearchParams({ list: listId });
  return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
}

/** Unique playlists that match any of the given makes (stable catalog order). */
export function playlistsForMakes(makes: string[]): ManufacturerPlaylist[] {
  const seen = new Set<string>();
  const out: ManufacturerPlaylist[] = [];
  const normalized = makes.map(norm).filter(Boolean);

  for (const entry of MANUFACTURER_PLAYLISTS) {
    if (seen.has(entry.id)) continue;
    const hit = normalized.some((m) => entry.matchesMake(m));
    if (hit) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}
