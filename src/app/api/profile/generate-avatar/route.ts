import { generateImage } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const MIN_LEN = 3;
const MAX_LEN = 600;

function buildAvatarPrompt(userDescription: string): string {
  const d = userDescription.trim();
  return `Square 1:1 avatar image suitable as a user profile picture. Clear, polished, visually appealing. Scene and subject as described: ${d}. Single centered composition, soft or neutral background unless the description calls for otherwise. No text, no captions, no watermarks, no logos, no UI elements. Photorealistic or high-quality stylized illustration as fits the description.`;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "AI avatars need GOOGLE_GENERATIVE_AI_API_KEY (Google AI Studio). Add it to your environment and redeploy.",
      },
      { status: 503 },
    );
  }

  let body: { prompt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim() ?? "";
  if (prompt.length < MIN_LEN) {
    return Response.json(
      { error: `Describe your avatar in at least ${MIN_LEN} characters.` },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_LEN) {
    return Response.json(
      { error: `Keep the description under ${MAX_LEN} characters.` },
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

  try {
    const { image } = await generateImage({
      model: google.image("gemini-2.5-flash-image"),
      prompt: buildAvatarPrompt(prompt),
      aspectRatio: "1:1",
    });

    const base64 = Buffer.from(image.uint8Array).toString("base64");

    return Response.json({
      mediaType: image.mediaType,
      base64,
    });
  } catch (e) {
    console.error("[generate-avatar]", e);
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
