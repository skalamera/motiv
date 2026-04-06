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
import {
  fetchManualPdfByIdForUser,
  fetchPrimaryManualPdf,
} from "@/lib/ai/manual-fetch";
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
    manualId?: string | null;
    mode?: "general" | "upgrades";
  };

  const { messages, carId, manualId } = body;
  const mode = body.mode === "upgrades" ? "upgrades" : "general";

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  const manualIdTrim = manualId?.trim() || null;

  let car: Car | null = null;
  let manualPdf: { buffer: Buffer; fileName: string } | null = null;

  if (manualIdTrim && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Manual PDF chat requires SUPABASE_SERVICE_ROLE_KEY on the server.", {
      status: 503,
    });
  }

  if (manualIdTrim && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const got = await fetchManualPdfByIdForUser(manualIdTrim, user.id);
    if (!got) {
      return new Response("Manual not found", { status: 404 });
    }
    if (carId && got.carId !== carId) {
      return new Response("Selected manual does not match vehicle", {
        status: 400,
      });
    }
    manualPdf = { buffer: got.buffer, fileName: got.fileName };
    const { data: carRow, error: carErr } = await supabase
      .from("cars")
      .select("*")
      .eq("id", got.carId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (carErr || !carRow) {
      return new Response("Car not found", { status: 404 });
    }
    car = carRow as Car;
  } else if (carId) {
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
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      manualPdf = await fetchPrimaryManualPdf(carId);
    }
  }

  const system = buildMotivSystemPrompt(car, {
    hasManualPdf: !!manualPdf,
    mode,
  });

  const modelMessages = await convertToModelMessages(messages, {
    tools: searchTools,
  });

  if (manualPdf) {
    modelMessages.unshift({
      role: "user",
      content: [
        {
          type: "text",
          text: `[Owner manual PDF: ${manualPdf.fileName}. Ground factory intervals, capacities, warnings, and procedures in this document; use web search as well for a full answer (TSBs, common issues, recalls context). Always include the exact owner-manual page number(s) for manual-based facts. If page numbers are not available in the retrieved content, state that explicitly instead of guessing.]`,
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
    tools: searchTools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
