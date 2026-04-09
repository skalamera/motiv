import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentDateForPrompt } from "@/lib/ai/current-date-for-prompt";
import { getMotivModel } from "@/lib/ai/model";
import type { Car } from "@/types/database";

export const maxDuration = 120;

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const itemSchema = z.object({
  task: z.string(),
  interval_miles: z.number().nullable().optional(),
  interval_months: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastCompletedDate: z.string().nullable().optional(),
  lastMileageAt: z.number().nullable().optional(),
});

const listSchema = z.object({
  items: z.array(itemSchema),
});

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    carId?: string;
    imageBase64?: string;
    mediaType?: string;
    pdfBase64?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = body.carId?.trim();
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
  const vehicleLine = `Vehicle context (for disambiguation only): ${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}.\n\n`;

  const rawPdf = body.pdfBase64?.trim();
  const rawImg = body.imageBase64?.trim();

  if (rawPdf && rawImg) {
    return Response.json(
      { error: "Send either pdfBase64 or imageBase64, not both" },
      { status: 400 },
    );
  }

  if (!rawPdf && !rawImg) {
    return Response.json(
      { error: "pdfBase64 or imageBase64 required" },
      { status: 400 },
    );
  }

  const instructions = `${currentDateForPrompt()}

${vehicleLine}You are reading a maintenance schedule document (printed table, dealer sheet, factory scheduled-maintenance chart, workshop excerpt, or a photo/list of handwritten tasks).

Extract each distinct scheduled maintenance item as its own row.
- task: concise name (e.g. "Engine oil & filter replacement").
- interval_miles / interval_months: use numbers from the document; null if not stated for that row.
- notes: brief provenance or footnotes (e.g. "severe service", "inspect only", "see note 3") under 350 characters; null if none.
- lastCompletedDate: YYYY-MM-DD only if the document clearly indicates a prior completion date for that line; else null.
- lastMileageAt: integer odometer only if explicitly shown for last service; else null.

Do not invent intervals or dates. Skip blank or illegible lines. If nothing is readable, return an empty items array.`;

  try {
    if (rawPdf) {
      let buffer: Buffer;
      try {
        buffer = Buffer.from(rawPdf, "base64");
      } catch {
        return Response.json({ error: "Invalid base64 PDF" }, { status: 400 });
      }
      if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
        return Response.json(
          { error: `PDF must be under ${MAX_PDF_BYTES / (1024 * 1024)} MB` },
          { status: 400 },
        );
      }

      const { object } = await generateObject({
        model: getMotivModel(),
        schema: listSchema,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instructions },
              {
                type: "file",
                data: buffer,
                mediaType: "application/pdf",
              },
            ],
          },
        ],
      });

      return Response.json({ items: object.items });
    }

    if (!rawImg) {
      return Response.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const mediaType = (body.mediaType || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE.has(mediaType)) {
      return Response.json(
        { error: `Unsupported image type. Use: ${[...ALLOWED_IMAGE].join(", ")}` },
        { status: 400 },
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawImg, "base64");
    } catch {
      return Response.json({ error: "Invalid base64 image" }, { status: 400 });
    }

    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: `Image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)} MB` },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: getMotivModel(),
      schema: listSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            { type: "image", image: buffer, mediaType },
          ],
        },
      ],
    });

    return Response.json({ items: object.items });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not read schedule" },
      { status: 500 },
    );
  }
}
