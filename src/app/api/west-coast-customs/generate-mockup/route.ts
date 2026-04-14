import { generateImage } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type PartInput = {
  category: string;
  name: string;
  brand: string;
  description: string;
  selectedOption?: string;
  imageUrl?: string;
  productUrl?: string;
};

function buildMockupPrompt(
  car: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    color?: string | null;
  },
  parts: PartInput[],
  angle: "front" | "rear",
): string {
  const vehicle = [car.year, car.make, car.model, car.trim]
    .filter(Boolean)
    .join(" ");
  const color =
    car.color?.trim() || "a realistic factory-correct exterior finish";

  const modLines = parts
    .map((p) => {
      const optionNote = p.selectedOption ? ` (${p.selectedOption})` : "";
      const imageNote = p.imageUrl
        ? ` [Reference image: ${p.imageUrl}]`
        : "";
      return `- ${p.category}: ${p.name} by ${p.brand}${optionNote} — ${p.description}${imageNote}`;
    })
    .join("\n");

  const angleDesc =
    angle === "front"
      ? "dramatic three-quarter front angle, low camera position, showing the front fascia and driver side"
      : "dramatic three-quarter rear angle, low camera position, showing the rear end and passenger side";

  return `Professional automotive photograph of a ${vehicle} COUPE (2-door body style — NOT a sedan, NOT a wagon, NOT an estate). Exterior color: ${color}. The car has the following aftermarket modifications installed:\n${modLines}\n\nIMPORTANT: This is a 2-door coupe with a shorter roofline and longer doors than the sedan. Render it strictly as a coupe. Show the car from a ${angleDesc}, in a dimly lit custom shop environment with warm workshop lighting and subtle neon accent glow. The modifications should be clearly visible and accurately represented. Photorealistic, cinematic lighting, shallow depth of field, no text or watermarks, no people.`;
}

async function generateOne(
  car: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    color?: string | null;
  },
  parts: PartInput[],
  angle: "front" | "rear",
): Promise<string> {
  const { image } = await generateImage({
    model: google.image("gemini-3.1-flash-image-preview"),
    prompt: buildMockupPrompt(car, parts, angle),
    aspectRatio: "16:9",
  });
  const base64 = Buffer.from(image.uint8Array).toString("base64");
  return `data:${image.mediaType};base64,${base64}`;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY is required for mockup generation.",
      },
      { status: 503 },
    );
  }

  let body: {
    carId?: string;
    selectedParts?: PartInput[];
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
  if (!body.selectedParts?.length) {
    return Response.json(
      { error: "At least one part must be selected" },
      { status: 400 },
    );
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
    .select("id, year, make, model, trim, color")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr || !car) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  try {
    const carData = {
      year: car.year,
      make: car.make,
      model: car.model,
      trim: car.trim,
      color: car.color,
    };

    // Generate front and rear shots in parallel
    const [frontUrl, rearUrl] = await Promise.all([
      generateOne(carData, body.selectedParts, "front"),
      generateOne(carData, body.selectedParts, "rear"),
    ]);

    return Response.json({ frontImageUrl: frontUrl, rearImageUrl: rearUrl });
  } catch (e) {
    console.error("[generate-mockup]", e);
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Mockup generation failed. Check API key and model availability.",
      },
      { status: 502 },
    );
  }
}
