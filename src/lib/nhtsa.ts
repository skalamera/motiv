const RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const MODELS_BASE = "https://api.nhtsa.gov/vehicles/models";
const VPIC_DECODE_EXTENDED =
  "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

export type RecallLookupMode = "vin_decode" | "profile";

export type RecallLookupMeta = {
  mode: RecallLookupMode;
  /** Values passed to NHTSA recallsByVehicle (may come from VPIC when using VIN). */
  queried: { make: string; model: string; modelYear: number };
  /** Valid 17-char VIN on file but VPIC did not return usable make/year. */
  vinDecodeFailed?: boolean;
  /** VIN present but fails VIN format rules. */
  invalidVinFormat?: boolean;
};

/** NHTSA standard: 17 chars, excludes I, O, Q. */
export function isValidVin(vin: string | null | undefined): boolean {
  if (!vin?.trim()) return false;
  const v = vin.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

export type VinDecodeForRecalls = {
  make: string;
  model: string;
  modelYear: number;
  /** VPIC Trim (often matches NHTSA recall model codes, e.g. E350 vs E-Class). */
  trim?: string;
  series?: string;
};

/**
 * Decode VIN via NHTSA VPIC for make / model / year (used to query recalls).
 */
export async function decodeVinForRecalls(
  vin: string,
): Promise<VinDecodeForRecalls | null> {
  const v = vin.trim().toUpperCase();
  if (!isValidVin(v)) return null;

  const url = `${VPIC_DECODE_EXTENDED}/${encodeURIComponent(v)}?format=json`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  let json: { Results?: Record<string, string>[] };
  try {
    json = (await res.json()) as { Results?: Record<string, string>[] };
  } catch {
    return null;
  }

  const row = json.Results?.[0];
  if (!row) return null;

  const make = String(row.Make ?? "").trim();
  const model = String(row.Model ?? "").trim();
  const yearStr = String(row.ModelYear ?? "").trim();
  const modelYear = parseInt(yearStr, 10);

  if (!make || !Number.isFinite(modelYear) || modelYear < 1900) {
    return null;
  }

  const trim = String(row.Trim ?? "").trim();
  const series = String(row.Series ?? "").trim();

  return {
    make,
    model,
    modelYear,
    ...(trim ? { trim } : {}),
    ...(series ? { series } : {}),
  };
}

export type NhtsaRecall = {
  NHTSACampaignNumber?: string;
  ReportReceivedDate?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  Notes?: string;
};

export type NhtsaResponse = {
  Count?: number;
  Message?: string;
  results?: NhtsaRecall[];
};

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * NHTSA often returns HTTP 400 with a JSON body that still has
 * `Message: "Results returned successfully"` and `results: []` when the
 * make/model/year combo is unknown or the model string includes trim
 * (e.g. "Civic EX" instead of "Civic"). Treat those like empty results.
 */
function parseRecallResponse(res: Response, json: unknown): NhtsaRecall[] {
  const data = json as NhtsaResponse;
  if (Array.isArray(data.results)) {
    return data.results;
  }
  throw new Error(`NHTSA API error ${res.status}`);
}

/** Longest official model name that matches user input (handles trim suffixes). */
function resolveModelForNhtsa(
  userModel: string,
  officialModels: string[],
): string {
  const u = norm(userModel);
  if (!u) return userModel.trim();

  const sorted = [...new Set(officialModels.map((m) => m.trim()).filter(Boolean))].sort(
    (a, b) => norm(b).length - norm(a).length,
  );

  for (const raw of sorted) {
    const o = norm(raw);
    if (u === o || u.startsWith(`${o} `)) {
      return raw;
    }
  }

  const first = u.split(" ")[0];
  const baseMatches = sorted.filter((raw) => norm(raw) === first);
  if (baseMatches.length === 1) {
    return baseMatches[0];
  }
  if (baseMatches.length > 1) {
    return baseMatches.sort((a, b) => norm(a).length - norm(b).length)[0];
  }

  return userModel.trim();
}

async function fetchOfficialModels(
  make: string,
  modelYear: number,
): Promise<string[]> {
  const makeTrim = make.trim();
  if (!makeTrim || !Number.isFinite(modelYear)) {
    return [];
  }

  const params = new URLSearchParams({
    make: makeTrim,
    modelYear: String(modelYear),
    max: "100",
  });

  const res = await fetch(`${MODELS_BASE}?${params}`, {
    next: { revalidate: 86_400 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return [];
  }

  const json = (await res.json()) as {
    results?: { vehicleModel?: string }[];
  };
  const list = json.results ?? [];
  return list
    .map((r) => r.vehicleModel)
    .filter((m): m is string => typeof m === "string" && m.length > 0);
}

export type FetchRecallsByVehicleOptions = {
  /**
   * When true, send `model` to NHTSA as-is. Use for fallbacks when VPIC/VPIC trim
   * disagrees with the vehicles/models catalog (e.g. recalls use "E350" but the
   * catalog maps "E-Class" → "E-CLASS", which returns zero recalls).
   */
  skipModelCatalogResolution?: boolean;
};

export async function fetchRecallsByVehicle(
  make: string,
  model: string,
  modelYear: number,
  options?: FetchRecallsByVehicleOptions,
): Promise<NhtsaRecall[]> {
  const makeTrim = make.trim();
  const modelTrim = model.trim();

  if (!makeTrim || !modelTrim) {
    return [];
  }

  if (
    !Number.isFinite(modelYear) ||
    modelYear < 1900 ||
    modelYear > new Date().getFullYear() + 1
  ) {
    return [];
  }

  let modelForApi = modelTrim;
  if (!options?.skipModelCatalogResolution) {
    const officials = await fetchOfficialModels(makeTrim, modelYear);
    modelForApi =
      officials.length > 0
        ? resolveModelForNhtsa(modelTrim, officials)
        : modelTrim;
  }

  const params = new URLSearchParams({
    make: makeTrim,
    model: modelForApi,
    modelYear: String(modelYear),
  });
  const url = `${RECALLS_BASE}?${params}`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`NHTSA API error ${res.status}`);
  }

  if (res.ok) {
    return parseRecallResponse(res, json);
  }

  if (res.status === 400) {
    try {
      return parseRecallResponse(res, json);
    } catch {
      const msg = (json as { Message?: string })?.Message;
      throw new Error(msg ?? `NHTSA API error ${res.status}`);
    }
  }

  const msg = (json as { Message?: string })?.Message;
  throw new Error(msg ?? `NHTSA API error ${res.status}`);
}

/**
 * Build ordered model strings for NHTSA recalls. Adds a no-spaces variant when
 * different (e.g. "E 350" → also try "E350").
 */
function mergeRecallModelCandidates(
  primary: string,
  extras: (string | null | undefined)[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function add(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const k = norm(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
    const compact = t.replace(/\s+/g, "");
    if (compact && norm(compact) !== k && !seen.has(norm(compact))) {
      seen.add(norm(compact));
      out.push(compact);
    }
  }

  add(primary);
  for (const e of extras) {
    if (e?.trim()) add(e.trim());
  }

  /**
   * NHTSA recalls are sometimes keyed only on the model line (e.g. "911") while
   * vehicles/models lists full trims ("911 CARRERA S") that return zero rows
   * from recallsByVehicle. Walk down to shorter prefixes (drop trailing tokens).
   */
  const toks = primary.trim().split(/\s+/).filter(Boolean);
  for (let n = toks.length - 1; n >= 1; n--) {
    if (n === 1 && toks[0].length < 2) continue;
    add(toks.slice(0, n).join(" "));
  }

  return out;
}

async function fetchRecallsByVehicleTryingModels(
  make: string,
  modelYear: number,
  candidates: string[],
): Promise<{ recalls: NhtsaRecall[]; winningModel: string }> {
  let last: NhtsaRecall[] = [];
  if (candidates.length === 0) {
    return { recalls: [], winningModel: "" };
  }
  for (const model of candidates) {
    last = await fetchRecallsByVehicle(make, model, modelYear);
    if (last.length > 0) return { recalls: last, winningModel: model };
    last = await fetchRecallsByVehicle(make, model, modelYear, {
      skipModelCatalogResolution: true,
    });
    if (last.length > 0) return { recalls: last, winningModel: model };
  }
  return { recalls: last, winningModel: candidates[0]! };
}

/**
 * Prefer VPIC VIN decode → NHTSA recallsByVehicle; otherwise use saved profile fields.
 * Tries multiple model tokens (VPIC Trim, compact profile model) because NHTSA’s
 * recalls catalog often uses codes like "E350" while VPIC returns "E-Class".
 */
export async function fetchRecallsForCar(input: {
  vin?: string | null;
  make: string;
  model: string;
  /** Saved `cars.model` only — extra recall tokens (e.g. "E 350" → "E350"). */
  profileModelBase?: string | null;
  modelYear: number;
}): Promise<{ recalls: NhtsaRecall[]; lookup: RecallLookupMeta }> {
  const profileModel = input.model.trim();
  const profileMake = input.make.trim();
  const profileBase = input.profileModelBase?.trim() ?? "";

  const profileLookup = (queriedModel: string): RecallLookupMeta => ({
    mode: "profile",
    queried: {
      make: profileMake,
      model: queriedModel,
      modelYear: input.modelYear,
    },
  });

  const vinTrim = input.vin?.trim() ?? "";

  if (isValidVin(input.vin)) {
    const decoded = await decodeVinForRecalls(input.vin!);
    if (decoded) {
      const modelForNhtsa =
        decoded.model.trim().length > 0 ? decoded.model : profileModel;
      if (modelForNhtsa.trim().length > 0) {
        const extras: (string | null | undefined)[] = [
          decoded.trim,
          decoded.series,
          profileBase || null,
        ];
        const candidates = mergeRecallModelCandidates(modelForNhtsa, extras);
        const { recalls, winningModel } =
          await fetchRecallsByVehicleTryingModels(
            decoded.make,
            decoded.modelYear,
            candidates,
          );
        return {
          recalls,
          lookup: {
            mode: "vin_decode",
            queried: {
              make: decoded.make,
              model: winningModel || modelForNhtsa,
              modelYear: decoded.modelYear,
            },
          },
        };
      }
    }
    const candidatesP = mergeRecallModelCandidates(profileModel, [
      profileBase || null,
    ]);
    const { recalls, winningModel } =
      await fetchRecallsByVehicleTryingModels(
        profileMake,
        input.modelYear,
        candidatesP,
      );
    return {
      recalls,
      lookup: {
        ...profileLookup(winningModel || profileModel),
        vinDecodeFailed: true,
      },
    };
  }

  if (vinTrim.length > 0) {
    const candidatesP = mergeRecallModelCandidates(profileModel, [
      profileBase || null,
    ]);
    const { recalls, winningModel } =
      await fetchRecallsByVehicleTryingModels(
        profileMake,
        input.modelYear,
        candidatesP,
      );
    return {
      recalls,
      lookup: {
        ...profileLookup(winningModel || profileModel),
        invalidVinFormat: true,
      },
    };
  }

  const candidatesP = mergeRecallModelCandidates(profileModel, [
    profileBase || null,
  ]);
  const { recalls, winningModel } = await fetchRecallsByVehicleTryingModels(
    profileMake,
    input.modelYear,
    candidatesP,
  );
  return {
    recalls,
    lookup: profileLookup(winningModel || profileModel),
  };
}
