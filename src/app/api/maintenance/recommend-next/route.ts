import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentDateForPrompt } from "@/lib/ai/current-date-for-prompt";
import { getMotivModel } from "@/lib/ai/model";
import {
  fetchMaintenanceManualPdfsForCar,
  fetchPrimaryManualPdf,
} from "@/lib/ai/manual-fetch";
import type { Car, MaintenanceSchedule } from "@/types/database";

export const maxDuration = 120;

const recommendationSchema = z.object({
  headline: z.string(),
  primaryService: z.string(),
  rationale: z.string(),
  urgency: z.enum(["routine", "soon", "due_now"]),
  estimatedMilesRemaining: z.number().nullable(),
  relatedScheduleTask: z.string().nullable(),
  caveats: z.string().nullable(),
});

function ymd(iso: string): string {
  try {
    return iso.slice(0, 10);
  } catch {
    return iso;
  }
}

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

  const { data: carRow, error: carErr } = await supabase
    .from("cars")
    .select("*")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr || !carRow) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  const car = carRow as Car;

  const ownerPdf =
    process.env.SUPABASE_SERVICE_ROLE_KEY && carId
      ? await fetchPrimaryManualPdf(carId)
      : null;
  const maintenancePdfs =
    process.env.SUPABASE_SERVICE_ROLE_KEY && carId
      ? await fetchMaintenanceManualPdfsForCar(carId)
      : [];

  const { data: scheduleRows } = await supabase
    .from("maintenance_schedules")
    .select("*")
    .eq("car_id", carId)
    .order("task");

  const schedules = (scheduleRows ?? []) as MaintenanceSchedule[];

  const { data: rawLogs } = await supabase
    .from("maintenance_logs")
    .select(
      `
      id,
      completed_at,
      mileage_at,
      notes,
      cost,
      title,
      maintenance_schedules ( task )
    `,
    )
    .eq("car_id", carId)
    .order("completed_at", { ascending: true })
    .limit(100);

  type LogJoin = {
    completed_at: string;
    mileage_at: number | null;
    notes: string | null;
    cost: number | null;
    title: string | null;
    maintenance_schedules: { task: string } | null;
  };

  const logLines: string[] = [];
  for (const raw of rawLogs ?? []) {
    const row = raw as unknown as LogJoin;
    const label =
      row.maintenance_schedules?.task?.trim() ||
      row.title?.trim() ||
      "Service";
    const mi = row.mileage_at != null ? `${row.mileage_at} mi` : "—";
    const cost =
      row.cost != null && Number.isFinite(Number(row.cost))
        ? `$${Number(row.cost).toFixed(2)}`
        : "—";
    const note = row.notes?.trim() ? ` | ${row.notes.trim().slice(0, 120)}` : "";
    logLines.push(
      `- ${ymd(row.completed_at)}: ${label} @ odometer ${mi}, cost ${cost}${note}`,
    );
  }

  const scheduleLines = schedules.map((s) => {
    const miles =
      s.interval_miles != null ? `${s.interval_miles.toLocaleString()} mi` : "—";
    const mo =
      s.interval_months != null ? `${s.interval_months} mo` : "—";
    const last = s.last_completed_at
      ? ymd(s.last_completed_at)
      : "never logged";
    const lastMi =
      s.last_mileage_at != null
        ? `${s.last_mileage_at.toLocaleString()} mi`
        : "—";
    return `- ${s.task}: repeat every ${miles} / ${mo}; last completed ${last} @ ${lastMi}; schedule notes: ${s.notes ?? "—"}`;
  });

  const vehicle = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const odometer = car.mileage;

  const manualSection =
    ownerPdf || maintenancePdfs.length > 0
      ? `Factory PDF references attached:${ownerPdf ? ` owner’s manual (${ownerPdf.fileName})` : ""}${maintenancePdfs.length ? `; maintenance / service manual(s): ${maintenancePdfs.map((p) => p.fileName).join(", ")}` : ""}. Cross-check intervals and service items against these documents—**give priority to maintenance/service manuals over the owner’s manual** when they differ on service specifics. Cite specific page numbers in your rationale when you rely on a PDF. Where the PDFs are silent, supplement with current reputable automotive guidance for this make/model and mileage. Note any conflict between manuals or between manuals and common practice in caveats.`
      : `No factory PDF manuals are attached for this car. Use the schedule and history below plus current reputable automotive knowledge for this vehicle. State in caveats that no manuals were provided.`;

  const context = `${manualSection}

Vehicle: ${vehicle}
Current odometer (from profile): ${odometer.toLocaleString()} mi

Maintenance schedule rows (${schedules.length}):
${scheduleLines.length ? scheduleLines.join("\n") : "(none — user may not have run auto-populate yet)"}

Service history (${logLines.length} records, chronological):
${logLines.length ? logLines.join("\n") : "(no service logs yet)"}

Use the schedule intervals and last_completed / log dates & mileages to judge what regular maintenance is most appropriate next relative to ${odometer.toLocaleString()} mi today.
If data is thin, still recommend a sensible next step and explain uncertainty in caveats.
urgency: "routine" = not urgent; "soon" = within ~1000 mi or ~2 months; "due_now" = overdue or safety-critical.
estimatedMilesRemaining: approximate miles until the recommended service is ideal, or null if not estimable.
relatedScheduleTask: copy the exact task name from the schedule list if one matches, else null.`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: "application/pdf" }
  > = [
    {
      type: "text",
      text: `${currentDateForPrompt()}

You are an automotive maintenance advisor. Recommend the single best NEXT regular maintenance service for this car.

${context}`,
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
      schema: recommendationSchema,
      messages: [{ role: "user", content }],
    });

    return Response.json({ recommendation: object });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Recommendation failed" },
      { status: 500 },
    );
  }
}
