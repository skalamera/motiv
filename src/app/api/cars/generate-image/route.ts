import { generateImage } from "ai";
import { google } from "@ai-sdk/google";
import { carImageUrlWithCacheBust } from "@/lib/car-image-url";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const CAR_IMAGES_BUCKET = "car-images";

async function ensureCarImagesBucket(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    return {
      ok: false,
      message:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it on Vercel (or create the `car-images` bucket in Supabase → Storage and apply storage policies from the repo migration).",
    };
  }

  const admin = createServiceRoleClient();
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    return { ok: false, message: listErr.message };
  }
  if (buckets?.some((b) => b.id === CAR_IMAGES_BUCKET)) {
    return { ok: true };
  }

  const { error: createErr } = await admin.storage.createBucket(CAR_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: 15 * 1024 * 1024,
  });
  if (createErr) {
    const m = createErr.message.toLowerCase();
    if (
      m.includes("already exists") ||
      m.includes("resource already exists") ||
      m.includes("duplicate")
    ) {
      return { ok: true };
    }
    return { ok: false, message: createErr.message };
  }
  return { ok: true };
}

function buildCarPhotoPrompt(parts: {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  body_type: string | null;
  drivetrain: string | null;
}): string {
  const trim = parts.trim?.trim();
  const color =
    parts.color?.trim() ||
    "a realistic factory-correct exterior finish (no specific color named)";
  const body = parts.body_type?.trim();
  const drive = parts.drivetrain?.trim();
  const vehicle = [parts.year, parts.make, parts.model, trim]
    .filter(Boolean)
    .join(" ");

  const bodyLine = body
    ? `Body style: ${body} (show correct roofline, door count, and proportions for this body type).`
    : "Body style: infer plausible proportions from make and model.";
  const driveLine = drive
    ? `Drivetrain: ${drive} (no need to show mechanical parts; correct stance and typical factory configuration for this layout).`
    : "";

  return `Professional automotive photograph of a ${vehicle}. Exterior color: ${color}. ${bodyLine}${driveLine ? ` ${driveLine}` : ""} Three-quarter front view, clean neutral studio lighting, subtle ground reflection, photorealistic metal and glass, sharp focus, no license plate text, no people, no logos or watermarks, no overlaid text.`;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "AI car photos need GOOGLE_GENERATIVE_AI_API_KEY (Google AI Studio). Add it to your environment and redeploy.",
      },
      { status: 503 },
    );
  }

  let body: { carId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = body.carId?.trim();
  if (!carId) {
    return Response.json({ error: "carId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: car, error: carErr } = await supabase
    .from("cars")
    .select("id, year, make, model, trim, color, body_type, drivetrain")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr || !car) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  try {
    const { image } = await generateImage({
      model: google.image("gemini-2.5-flash-image"),
      prompt: buildCarPhotoPrompt({
        year: car.year,
        make: car.make,
        model: car.model,
        trim: car.trim,
        color: car.color,
        body_type: car.body_type,
        drivetrain: car.drivetrain,
      }),
      aspectRatio: "16:9",
    });

    const ext = image.mediaType.includes("png") ? "png" : "jpg";
    const objectPath = `${user.id}/${carId}/cover.${ext}`;
    const bytes = Buffer.from(image.uint8Array);
    const blob = new Blob([bytes], { type: image.mediaType });

    const bucketReady = await ensureCarImagesBucket();
    if (!bucketReady.ok) {
      console.error("[generate-image] bucket:", bucketReady.message);
      return Response.json({ error: bucketReady.message }, { status: 503 });
    }

    const admin = createServiceRoleClient();
    const { error: upErr } = await admin.storage
      .from(CAR_IMAGES_BUCKET)
      .upload(objectPath, blob, {
        contentType: image.mediaType,
        upsert: true,
      });

    if (upErr) {
      console.error("[generate-image] storage upload:", upErr);
      const msg = upErr.message || "Could not save image";
      const hint =
        msg.toLowerCase().includes("bucket") && msg.toLowerCase().includes("not found")
          ? " Open Supabase → Storage → New bucket, id exactly `car-images`, enable public. Or redeploy after setting SUPABASE_SERVICE_ROLE_KEY so the app can create it."
          : "";
      return Response.json({ error: msg + hint }, { status: 500 });
    }

    const {
      data: { publicUrl: rawPublicUrl },
    } = admin.storage.from(CAR_IMAGES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = carImageUrlWithCacheBust(rawPublicUrl);

    const { error: updErr } = await supabase
      .from("cars")
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", carId)
      .eq("user_id", user.id);

    if (updErr) {
      console.error("[generate-image] cars update:", updErr);
      return Response.json(
        { error: updErr.message || "Could not update car" },
        { status: 500 },
      );
    }

    return Response.json({ imageUrl: publicUrl });
  } catch (e) {
    console.error("[generate-image]", e);
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Image generation failed. Check API key and model availability.",
      },
      { status: 502 },
    );
  }
}
