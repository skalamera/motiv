import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentDateForPrompt } from "@/lib/ai/current-date-for-prompt";
import { getMotivModel } from "@/lib/ai/model";
import {
  fetchMaintenanceManualPdfsForCar,
  fetchPrimaryManualPdf,
} from "@/lib/ai/manual-fetch";
import type { Car } from "@/types/database";

/** DB columns are integer; model may return decimals (e.g. 0.5) — coerce before insert. */
function intervalToDbInt(
  n: number | null | undefined,
): number | null {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r > 0 ? r : null;
}

const scheduleSchema = z.object({
  items: z.array(
    z.object({
      task: z.string(),
      interval_miles: z.number().nullable().optional(),
      interval_months: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      source: z.enum(["manual", "web"]),
    }),
  ),
});

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { carId } = (await req.json()) as { carId?: string };
  if (!carId) {
    return Response.json({ error: "carId required" }, { status: 400 });
  }

  const { data: car, error } = await supabase
    .from("cars")
    .select("*")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !car) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  const c = car as Car;
  const ownerPdf =
    process.env.SUPABASE_SERVICE_ROLE_KEY && carId
      ? await fetchPrimaryManualPdf(carId)
      : null;
  const maintenancePdfs =
    process.env.SUPABASE_SERVICE_ROLE_KEY && carId
      ? await fetchMaintenanceManualPdfsForCar(carId)
      : [];

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: "application/pdf" }
  > = [
    {
      type: "text",
      text: `${currentDateForPrompt()}

Extract the manufacturer-recommended maintenance schedule for a ${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}.

Return items like oil change, tire rotation, brake fluid, coolant, filters, spark plugs, belts, inspections, etc.
Use interval_miles and/or interval_months when specified. Each must be a **positive whole number** (integer miles or whole months only — never decimals like 0.5); use null if you cannot state a whole-number interval.
If an owner’s manual PDF is attached, use it for general factory guidance and set source to "manual" when intervals come from it.
If maintenance / service manual PDFs are also attached, **prefer them over the owner’s manual** for interval and service-item specifics when they differ; still set source to "manual" when grounded in any attached PDF (note which doc in the item notes if helpful).
If no PDF supports an item, set source to "web" and infer typical factory intervals (state uncertainty in notes).

If you cannot find data, return best-effort generic intervals with source "web" and clear notes.`,
    },
  ];

  if (ownerPdf) {
    content.push({
      type: "file",
      data: ownerPdf.buffer,
      mediaType: "application/pdf",
    });
  }
  for (const p of maintenancePdfs) {
    content.push({
      type: "file",
      data: p.buffer,
      mediaType: "application/pdf",
    });
  }

  try {
    const { object } = await generateObject({
      model: getMotivModel(),
      schema: scheduleSchema,
      messages: [{ role: "user", content }],
    });

    const rows = object.items.map((item) => ({
      car_id: carId,
      task: item.task,
      interval_miles: intervalToDbInt(item.interval_miles),
      interval_months: intervalToDbInt(item.interval_months),
      notes: item.notes ?? null,
      is_custom: false,
      source: item.source,
    }));

    const { error: delErr } = await supabase
      .from("maintenance_schedules")
      .delete()
      .eq("car_id", carId)
      .eq("is_custom", false);

    if (delErr) {
      console.error(delErr);
    }

    const { data: inserted, error: insErr } = await supabase
      .from("maintenance_schedules")
      .insert(rows)
      .select();

    if (insErr) {
      return Response.json({ error: insErr.message }, { status: 500 });
    }

    return Response.json({ schedules: inserted });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}
