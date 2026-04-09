import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentDateForPrompt } from "@/lib/ai/current-date-for-prompt";
import { getMotivModel } from "@/lib/ai/model";

export const maxDuration = 120;

const waypointSchema = z.object({
  label: z
    .string()
    .describe(
      "Short name for UI and map marker, e.g. park or business name only.",
    ),
  placeQuery: z
    .string()
    .min(8)
    .describe(
      "One real, searchable place for Google Maps: named park, trailhead, scenic overlook, restaurant, marina, museum, beach access, etc. Include city and state (e.g. 'Kings Landing Park, Huntingtown, MD'). Must NOT be raw lat/lng or a street address that is not a known POI.",
    ),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const driveSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedDurationMinutes: z
    .number()
    .int()
    .min(25)
    .max(600),
  highlights: z.array(z.string()).max(8),
  waypoints: z.array(waypointSchema).min(2).max(12),
  googleMapsDirectionsHint: z.string().optional(),
});

function localDrivesSchema(preview: boolean) {
  return z.object({
    mapCenter: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    drives: z
      .array(driveSchema)
      .min(preview ? 1 : 3)
      .max(preview ? 1 : 8),
  });
}

const SYSTEM_BASE = `You suggest real-world scenic drives near the user's home. Use accurate geography: real parks, trailheads, coastal pullouts, scenic overlooks, small-town main streets, marinas, lighthouses, wineries, or other recognizable POIs that exist in that region.

Each drive is a loop or out-and-back suitable for a pleasant car trip.

WAYPOINTS (critical):
- Do NOT include the user's home address as a waypoint. The app will add it as start and end in Google Maps.
- Every waypoint must be a named place people can find on Google Maps: parks, named viewpoints, specific businesses, landmarks, ferry terminals, state/national park entrances, etc.
- placeQuery must be a rich search string: "Place Name, City, ST" (or county if needed). Never use bare coordinates or vague text like "scenic overlook" without a real, named location.
- label is a short title for the same stop (usually the place name without repeating the full address).

Return latitude/longitude in WGS84 for every waypoint for map plotting, ordered along the drive. Coordinates should match the real-world location of that POI as closely as you can. Do not put points in the ocean unless it is a true coastal road stop.

Keep descriptions concise and practical (road type, views, season tips when relevant).`;

export async function POST(req: Request) {
  let preview = false;
  try {
    const text = await req.text();
    if (text.trim()) {
      const parsed = JSON.parse(text) as { preview?: boolean };
      preview = Boolean(parsed.preview);
    }
  } catch {
    preview = false;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" as const },
      { status: 401 },
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("location_address")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return Response.json({ error: profErr.message }, { status: 500 });
  }

  const locationAddress = (profile as { location_address?: string | null } | null)
    ?.location_address?.trim();
  if (!locationAddress) {
    return Response.json(
      {
        error:
          "Add your address under Settings → Location to get local drive ideas.",
        code: "NO_LOCATION" as const,
      },
      { status: 400 },
    );
  }

  try {
    const userPrompt = preview
      ? `User home address (regional context only — do not repeat it in the waypoints list):\n${locationAddress}\n\nPropose exactly ONE scenic drive within roughly 30–120 minutes of driving, appropriate for this location. Make it memorable and varied for the region.`
      : `User home address (regional context only — do not repeat it in the waypoints list):\n${locationAddress}\n\nPropose varied scenic drives (different directions and character) within roughly 30–120 minutes of driving, appropriate for this location.`;

    const { object } = await generateObject({
      model: getMotivModel(),
      schema: localDrivesSchema(preview),
      system:
        preview === true
          ? `${currentDateForPrompt()}\n\n${SYSTEM_BASE}\n\nReturn exactly one drive in the drives array.`
          : `${currentDateForPrompt()}\n\n${SYSTEM_BASE}`,
      prompt: userPrompt,
    });

    return Response.json({
      locationAddress,
      mapCenter: object.mapCenter,
      drives: object.drives,
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}
