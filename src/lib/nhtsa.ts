const BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

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

export async function fetchRecallsByVehicle(
  make: string,
  model: string,
  modelYear: number,
): Promise<NhtsaRecall[]> {
  const params = new URLSearchParams({
    make: make.trim(),
    model: model.trim(),
    modelYear: String(modelYear),
  });
  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`NHTSA API error ${res.status}`);
  }
  const json = (await res.json()) as NhtsaResponse;
  return json.results ?? [];
}
