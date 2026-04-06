export type ScenicWaypoint = {
  /** Short marker / list title (e.g. park or business name). */
  label: string;
  /**
   * Full string for Google Maps search — real landmark, park, trailhead, restaurant,
   * marina, etc., with city/state for disambiguation. Never bare coordinates.
   * Optional for older saved responses; new API runs always set this.
   */
  placeQuery?: string;
  lat: number;
  lng: number;
};

export type ScenicDrive = {
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  highlights: string[];
  waypoints: ScenicWaypoint[];
  googleMapsDirectionsHint?: string;
};

export type LocalDrivesResponse = {
  locationAddress: string;
  mapCenter: { lat: number; lng: number };
  drives: ScenicDrive[];
};

export type LocalDrivesErrorBody = {
  error: string;
  code?: "NO_LOCATION" | "UNAUTHORIZED";
};
