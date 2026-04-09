import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentDateForPrompt } from "@/lib/ai/current-date-for-prompt";
import { getMotivModel } from "@/lib/ai/model";
import type { Car } from "@/types/database";

export const maxDuration = 60;

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const receiptSchema = z.object({
  title: z.string(),
  serviceDate: z.string().nullable(),
  mileageAt: z.number().nullable(),
  totalCost: z.number().nullable(),
  notes: z.string().nullable(),
});

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    imageBase64?: string;
    mediaType?: string;
    carId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawB64 = body.imageBase64?.trim();
  if (!rawB64) {
    return Response.json({ error: "imageBase64 required" }, { status: 400 });
  }

  const mediaType = (body.mediaType || "image/jpeg").toLowerCase();
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return Response.json(
      { error: `Unsupported image type. Use: ${[...ALLOWED_MEDIA].join(", ")}` },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(rawB64, "base64");
  } catch {
    return Response.json({ error: "Invalid base64 image" }, { status: 400 });
  }

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: `Image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }

  let carLine = "";
  if (body.carId) {
    const { data: car, error } = await supabase
      .from("cars")
      .select("*")
      .eq("id", body.carId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && car) {
      const c = car as Car;
      carLine = `The owner's vehicle is a ${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}. Use this only to resolve ambiguous handwriting; extract values from the receipt image.\n\n`;
    }
  }

  const instructions = `${currentDateForPrompt()}

${carLine}You are reading a photo of an automotive service receipt, repair invoice, or work order.

Extract:
- title: Short description of the main service (e.g. "Synthetic oil change", "Front brake pads & rotors"). If several items, summarize in one line.
- serviceDate: Service or invoice date as YYYY-MM-DD if clearly visible; otherwise null. Prefer service date over "printed" date when both exist.
- mileageAt: Odometer reading as an integer if shown; otherwise null.
- totalCost: Total charged as a number only (no $); use final total after tax if shown; otherwise null.
- notes: Shop name, RO#, address, or brief line-item summary (under 400 characters); null if nothing useful.

If the image is not a service document, return your best-effort title and nulls for uncertain fields.`;

  try {
    const { object } = await generateObject({
      model: getMotivModel(),
      schema: receiptSchema,
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

    return Response.json({ parsed: object });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not read receipt" },
      { status: 500 },
    );
  }
}
