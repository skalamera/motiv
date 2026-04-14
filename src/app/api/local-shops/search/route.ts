import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import type { Car } from "@/types/database";

export const maxDuration = 120;

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function geocodeAddress(
  address: string,
  key: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };
  if (data.status === "OK" && data.results[0]) {
    return data.results[0].geometry.location;
  }
  return null;
}

async function findPlaceId(
  name: string,
  address: string,
  key: string,
): Promise<string | null> {
  const query = `${name} ${address}`;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    candidates: Array<{ place_id: string }>;
  };
  if (data.status === "OK" && data.candidates?.[0]) {
    return data.candidates[0].place_id;
  }
  return null;
}

type PlaceDetails = {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: { lat: number; lng: number } };
};

async function getPlaceDetails(
  placeId: string,
  key: string,
): Promise<PlaceDetails | null> {
  const fields =
    "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as { status: string; result: PlaceDetails };
  if (data.status === "OK") return data.result;
  return null;
}

type YelpResult = { rating: number; reviews: number } | null;

async function getYelpData(
  name: string,
  address: string,
  yelpKey: string,
): Promise<YelpResult> {
  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(address)}&limit=1&sort_by=best_match`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${yelpKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      businesses?: Array<{ name: string; rating: number; review_count: number }>;
    };
    const biz = data.businesses?.[0];
    if (!biz) return null;
    // Fuzzy match: first word of the shop name should appear in the Yelp result
    const firstWord = name.split(" ")[0].toLowerCase();
    if (!biz.name.toLowerCase().includes(firstWord)) return null;
    return { rating: biz.rating, reviews: biz.review_count };
  } catch {
    return null;
  }
}

function confidenceWeight(totalReviews: number): number {
  if (totalReviews > 200) return 0.5;
  if (totalReviews >= 100) return 0.25;
  if (totalReviews >= 50) return 0.1;
  if (totalReviews < 20) return -0.25;
  return 0;
}

// ── Car-specific technical focus ──────────────────────────────────────────────

function getMakeSpecificFocus(car: Car) {
  const make = car.make.toLowerCase();
  if (make.includes("porsche")) {
    return {
      tools: "PIWIS III dealer-level diagnostics",
      issues: "water pump/vacuum system leaks, Change Over Valve failures, PDK calibration",
      maintenance: "PDK Fill Mode service, spark plug replacement on turbo models, 30k/60k services",
    };
  }
  if (make.includes("mercedes") || make.includes("benz")) {
    return {
      tools: "XENTRY/DAS Star Diagnosis",
      issues: "AMG engine-specific failures, SpeedShift MCT calibration, ABC suspension faults",
      maintenance: "AMG oil service, M-series spark plugs, transmission fluid service",
    };
  }
  if (make.includes("bmw")) {
    return {
      tools: "ISTA/D dealer diagnostics, NCS Expert coding",
      issues: "VANOS failures, HPFP issues, valve stem seals, timing chain wear",
      maintenance: "ZF 8HP transmission service, VANOS solenoid, timing chain inspection",
    };
  }
  if (make.includes("audi") || make.includes("volkswagen") || make.includes("vw")) {
    return {
      tools: "VCDS/ODIS dealer diagnostics",
      issues: "DSG mechatronic failures, timing chain tensioner, quattro drivetrain",
      maintenance: "DSG fluid service, Haldex differential fluid, timing belt/chain intervals",
    };
  }
  if (make.includes("ferrari") || make.includes("lamborghini") || make.includes("mclaren")) {
    return {
      tools: "OEM exotic diagnostic software",
      issues: "exotic drivetrain calibration, carbon ceramic brakes, suspension calibration",
      maintenance: "factory exotic service intervals, clutch service, major engine-out service",
    };
  }
  return {
    tools: "dealer-level OEM diagnostic software",
    issues: `${car.make} ${car.model}-specific engine and transmission issues`,
    maintenance: `${car.make} factory service intervals and major maintenance`,
  };
}

// ── Gemini discovery prompt (qualitative only — no ratings) ───────────────────

function buildDiscoveryPrompt(car: Car, address: string): string {
  const vehicleName = [car.year, car.make, car.model, car.trim]
    .filter(Boolean)
    .join(" ");
  const focus = getMakeSpecificFocus(car);

  return `You are a specialized Automotive Market Research Analyst.

Find 8 to 10 independent repair shops within a 50-mile radius of "${address}" that specialize in ${vehicleName} vehicles.

Requirements:
- ${car.make} specialists, European/import specialists, or performance shops with documented ${car.make} experience
- NO official ${car.make} dealerships
- Real businesses with verifiable physical addresses
- Prioritize shops that demonstrate: ${focus.tools}, expertise with ${focus.issues}, and ${focus.maintenance}

For EACH shop return ONLY these fields — do NOT include ratings (those are fetched separately):
- name: exact business name as it appears on Google Maps
- address: full street address with city, state, ZIP
- technicalCompetency: 1-2 sentences on their ${car.make}/${car.model} specific capabilities
- sentimentSummary: 2-3 sentences on customer consensus regarding quality and communication
- rankingAnalysis: 1-2 sentences on their reputation balance
- bestFor: short phrase (e.g. Routine Service, Major Engine Repairs, Performance Tuning, High-Tech Diagnostics)
- commuteDifficulty: Easy/Moderate/Difficult + brief route note from "${address}"
- specialistCapability: one sentence on ${car.make}/${car.model} tools and documented experience

Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{"shops":[{"name":"...","address":"...","technicalCompetency":"...","sentimentSummary":"...","rankingAnalysis":"...","bestFor":"...","commuteDifficulty":"...","specialistCapability":"..."}]}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { carId?: string; address?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = body.carId?.trim();
  const overrideAddress = body.address?.trim();
  if (!carId) return Response.json({ error: "carId required" }, { status: 400 });

  const { data: car, error: carErr } = await supabase
    .from("cars")
    .select("id, year, make, model, trim")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (carErr || !car) return Response.json({ error: "Car not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("location_address")
    .eq("id", user.id)
    .maybeSingle();

  const address = overrideAddress ?? profile?.location_address;
  if (!address) {
    return Response.json(
      { error: "No address found. Add your address in your profile." },
      { status: 400 },
    );
  }

  const mapsKey = process.env.GOOGLE_MAPS_API ?? "";
  const yelpKey = process.env.YELP_API_KEY ?? "";

  if (!mapsKey) {
    return Response.json(
      { error: "GOOGLE_MAPS_API key not configured." },
      { status: 503 },
    );
  }

  // 1. Geocode user address
  const userLatLng = await geocodeAddress(address, mapsKey);

  // 2. Gemini: discover shop names + qualitative data
  let geminiShops: Array<Record<string, string>> = [];
  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: buildDiscoveryPrompt(car as Car, address),
    });
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    let parsed: { shops: Array<Record<string, string>> };
    try {
      parsed = JSON.parse(cleaned) as typeof parsed;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse shop list from AI.");
      parsed = JSON.parse(match[0]) as typeof parsed;
    }
    geminiShops = parsed.shops ?? [];
  } catch (e) {
    console.error("[local-shops] Gemini error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "AI shop discovery failed." },
      { status: 502 },
    );
  }

  // 3. Enrich each shop with real Google Places + Yelp data (parallel)
  const vehicleName = [car.year, car.make, car.model, car.trim]
    .filter(Boolean)
    .join(" ");

  const enriched = await Promise.all(
    geminiShops.map(async (shop) => {
      const name = shop.name ?? "";
      const addr = shop.address ?? "";

      // Google Places: find + details
      const placeId = await findPlaceId(name, addr, mapsKey);
      if (!placeId) return null;
      const details = await getPlaceDetails(placeId, mapsKey);
      if (!details) return null;

      const { lat, lng } = details.geometry.location;

      // Yelp (optional)
      const yelpData = yelpKey
        ? await getYelpData(name, details.formatted_address, yelpKey)
        : null;

      // Distance
      const distance = userLatLng
        ? haversine(userLatLng.lat, userLatLng.lng, lat, lng)
        : 0;

      // Volume of Confidence algorithm
      const googleRating = details.rating ?? null;
      const googleReviews = details.user_ratings_total ?? null;
      const yelpRating = yelpData?.rating ?? null;
      const yelpReviews = yelpData?.reviews ?? null;

      const ratings = [googleRating, yelpRating].filter((r): r is number => r !== null);
      const baseScore = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const totalReviews = (googleReviews ?? 0) + (yelpReviews ?? 0);
      const weight = confidenceWeight(totalReviews);
      const finalScore = baseScore + weight;

      return {
        name: details.name,
        address: details.formatted_address,
        phone: details.formatted_phone_number ?? null,
        website: details.website ?? null,
        distance: Math.round(distance * 10) / 10,
        googleRating,
        googleReviews,
        yelpRating,
        yelpReviews,
        baseScore: Math.round(baseScore * 100) / 100,
        confidenceWeight: weight,
        finalScore: Math.round(finalScore * 100) / 100,
        technicalCompetency: shop.technicalCompetency ?? "",
        sentimentSummary: shop.sentimentSummary ?? "",
        rankingAnalysis: shop.rankingAnalysis ?? "",
        bestFor: shop.bestFor ?? "",
        commuteDifficulty: shop.commuteDifficulty ?? "",
        specialistCapability: shop.specialistCapability ?? "",
        lat,
        lng,
      };
    }),
  );

  // 4. Filter nulls (Places not found), filter > 50 miles, sort by finalScore, assign ranks
  const shops = enriched
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => s.distance <= 50)
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return Response.json({ shops, car: vehicleName, userAddress: address });
}
