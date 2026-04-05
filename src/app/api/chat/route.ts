import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { buildMotivSystemPrompt } from "@/lib/ai/prompts";
import { getMotivModel } from "@/lib/ai/model";
import { fetchPrimaryManualPdf } from "@/lib/ai/manual-fetch";
import type { Car } from "@/types/database";

export const maxDuration = 120;

const searchTools = {
  google_search: google.tools.googleSearch({}),
} as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    carId?: string | null;
    queryMode?: string;
  };

  const { messages, carId, queryMode = "auto" } = body;

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  let car: Car | null = null;
  if (carId) {
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("id", carId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) {
      return new Response("Car not found", { status: 404 });
    }
    car = data as Car;
  }

  const attachManual =
    !!carId &&
    (queryMode === "maintenance" || queryMode === "auto") &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const manualPdf = attachManual
    ? await fetchPrimaryManualPdf(carId!)
    : null;

  const system = buildMotivSystemPrompt(car, {
    hasManualPdf: !!manualPdf,
    queryMode,
  });

  const useSearch = queryMode === "issue" || queryMode === "auto";

  const modelMessages = await convertToModelMessages(messages, {
    tools: useSearch ? searchTools : undefined,
  });

  if (manualPdf) {
    modelMessages.unshift({
      role: "user",
      content: [
        {
          type: "text",
          text: `[Official owner manual PDF: ${manualPdf.fileName}. Use it for maintenance specs and procedures.]`,
        },
        {
          type: "file",
          data: manualPdf.buffer,
          mediaType: "application/pdf",
        },
      ],
    });
  }

  const result = streamText({
    model: getMotivModel(),
    system,
    messages: modelMessages,
    tools: useSearch ? searchTools : undefined,
    stopWhen: useSearch ? stepCountIs(8) : stepCountIs(1),
  });

  return result.toUIMessageStreamResponse();
}
