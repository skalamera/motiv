import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMotivModel } from "@/lib/ai/model";
import { fetchPrimaryManualPdf } from "@/lib/ai/manual-fetch";
import type { Car } from "@/types/database";

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
  const manualPdf =
    process.env.SUPABASE_SERVICE_ROLE_KEY && carId
      ? await fetchPrimaryManualPdf(carId)
      : null;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: "application/pdf" }
  > = [
    {
      type: "text",
      text: `Extract the manufacturer-recommended maintenance schedule for a ${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}.

Return items like oil change, tire rotation, brake fluid, coolant, filters, spark plugs, belts, inspections, etc.
Use interval_miles and/or interval_months when specified. If the manual is attached, set source to "manual" and follow it. Otherwise set source to "web" and infer typical factory intervals (state uncertainty in notes).

If you cannot find data, return best-effort generic intervals with source "web" and clear notes.`,
    },
  ];

  if (manualPdf) {
    content.push({
      type: "file",
      data: manualPdf.buffer,
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
      interval_miles: item.interval_miles ?? null,
      interval_months: item.interval_months ?? null,
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
