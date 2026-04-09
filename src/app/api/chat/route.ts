import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildMotivSystemPrompt,
  type SourceContextState,
} from "@/lib/ai/prompts";
import { getMotivModel } from "@/lib/ai/model";
import {
  fetchManualPdfByIdForUser,
  fetchMaintenanceManualPdfsForCar,
  fetchOtherManualPdfsForCar,
  fetchPrimaryManualPdf,
} from "@/lib/ai/manual-fetch";
import { searchWorkshopLibraryChunks } from "@/lib/ai/workshop-library-search";
import {
  normalizeChatSourcePreferences,
  type ChatSourcePreferences,
} from "@/types/chat-sources";
import type { Car } from "@/types/database";

export const maxDuration = 120;

const searchTools = {
  google_search: google.tools.googleSearch({}),
} as const;

function workshopSearchTool(libraryKey: string) {
  return tool({
    description: `Search indexed workshop/service HTML documentation for this vehicle (library "${libraryKey}"). Use for repair procedures, wiring, diagnostics, torques, and component detail. Pass a short keyword-style query.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Focused phrase, e.g. "brake fluid bleeding" or "oil filter housing"',
        ),
    }),
    execute: async ({ query }) => {
      try {
        const hits = await searchWorkshopLibraryChunks(libraryKey, query, 12);
        return {
          snippets: hits.map((h) => ({
            source: h.source_path,
            chunk: h.chunk_index,
            text: h.content,
            similarity: Math.round(h.similarity * 1000) / 1000,
          })),
        };
      } catch (e) {
        return {
          snippets: [] as const,
          error: e instanceof Error ? e.message : "Workshop search failed",
        };
      }
    },
  });
}

function sourceState(onFile: boolean, inContext: boolean): SourceContextState {
  if (inContext) return "in_context";
  if (onFile) return "skipped";
  return "none";
}

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
    sourcePreferences?: Partial<ChatSourcePreferences> | null;
  };

  const { messages, carId, manualId } = body;
  const mode = body.mode === "upgrades" ? "upgrades" : "general";
  const sp = normalizeChatSourcePreferences(body.sourcePreferences);

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  const manualIdTrim = manualId?.trim() || null;

  let car: Car | null = null;
  let carIdForDocs: string | null = null;

  let ownerManualPdf: { buffer: Buffer; fileName: string } | null = null;
  let maintenancePdfs: { buffer: Buffer; fileName: string }[] = [];
  let otherPdfs: { buffer: Buffer; fileName: string }[] = [];

  let ownerState: SourceContextState = "none";
  let serviceState: SourceContextState = "none";
  let otherState: SourceContextState = "none";
  let workshopState: SourceContextState = "none";
  let useWeb = sp.web;

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
    carIdForDocs = got.carId;
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

    /* Library FAB: always attach the opened PDF; still honor web + workshop toggles. */
    if (got.manualKind === "owner") {
      ownerManualPdf = { buffer: got.buffer, fileName: got.fileName };
      ownerState = "in_context";
      serviceState = "none";
      otherState = "none";
    } else if (got.manualKind === "maintenance") {
      maintenancePdfs = [{ buffer: got.buffer, fileName: got.fileName }];
      ownerState = "none";
      serviceState = "in_context";
      otherState = "none";
    } else {
      otherPdfs = [{ buffer: got.buffer, fileName: got.fileName }];
      ownerState = "none";
      serviceState = "none";
      otherState = "in_context";
    }

    const workshopLibraryKeyFab = car.car_library_key?.trim() || null;
    const canEmbedWorkshopFab =
      !!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      !!process.env.AI_GATEWAY_API_KEY?.trim();
    const canWorkshopFab =
      !!workshopLibraryKeyFab &&
      !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
      canEmbedWorkshopFab;
    workshopState = sourceState(canWorkshopFab, canWorkshopFab && sp.workshop);
    useWeb = sp.web;
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
    carIdForDocs = car.id;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      ownerManualPdf = await fetchPrimaryManualPdf(carId);
      maintenancePdfs = await fetchMaintenanceManualPdfsForCar(carId);
      otherPdfs = await fetchOtherManualPdfsForCar(carId);
    }

    const hasOwner = !!ownerManualPdf;
    const hasService = maintenancePdfs.length > 0;
    const hasOther = otherPdfs.length > 0;

    ownerState = sourceState(hasOwner, hasOwner && sp.owner);
    serviceState = sourceState(hasService, hasService && sp.service);
    otherState = sourceState(hasOther, hasOther && sp.otherDocs);

    const workshopLibraryKey = car.car_library_key?.trim() || null;
    const canEmbedWorkshop =
      !!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      !!process.env.AI_GATEWAY_API_KEY?.trim();
    const canWorkshopSearch =
      !!workshopLibraryKey &&
      !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
      canEmbedWorkshop;
    workshopState = sourceState(canWorkshopSearch, canWorkshopSearch && sp.workshop);
    useWeb = sp.web;

    if (!sp.owner) ownerManualPdf = null;
    if (!sp.service) maintenancePdfs = [];
    if (!sp.otherDocs) otherPdfs = [];
  }

  const workshopLibraryKey = car?.car_library_key?.trim() || null;
  const canEmbedWorkshop =
    !!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    !!process.env.AI_GATEWAY_API_KEY?.trim();
  const canWorkshopSearch =
    !!workshopLibraryKey &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    canEmbedWorkshop;

  const toolsForRequest: ToolSet = {
    ...searchTools,
    ...(canWorkshopSearch
      ? { search_workshop_library: workshopSearchTool(workshopLibraryKey!) }
      : {}),
  };

  const offeredToolNames: ("google_search" | "search_workshop_library")[] = [
    "google_search",
  ];
  if (canWorkshopSearch) offeredToolNames.push("search_workshop_library");

  const activeToolNames: ("google_search" | "search_workshop_library")[] = [];
  if (useWeb) activeToolNames.push("google_search");
  if (canWorkshopSearch && sp.workshop) {
    activeToolNames.push("search_workshop_library");
  }

  const sameOfferedAndActive =
    activeToolNames.length === offeredToolNames.length &&
    offeredToolNames.every((n) => activeToolNames.includes(n));

  const activeTools = sameOfferedAndActive
    ? undefined
    : activeToolNames;

  const system = buildMotivSystemPrompt(car, {
    ownerManual: ownerState,
    serviceManual: serviceState,
    otherDocs: otherState,
    workshop: workshopState,
    webSearch: useWeb,
    mode,
  });

  const modelMessages = await convertToModelMessages(messages, {
    tools: toolsForRequest,
  });

  const hasAnyPdf =
    !!ownerManualPdf || maintenancePdfs.length > 0 || otherPdfs.length > 0;

  if (hasAnyPdf) {
    const chunks: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: "application/pdf" }
    > = [];

    const lines: string[] = [];
    if (ownerManualPdf) {
      lines.push(
        `[Owner’s manual PDF: ${ownerManualPdf.fileName}. Ground owner-book facts; cite exact page numbers for each claim. If pages are not visible in the content you receive, say so.]`,
      );
    }
    maintenancePdfs.forEach((p, i) => {
      lines.push(
        `[Service / maintenance manual PDF ${i + 1} (${p.fileName}): cross-reference for scheduled maintenance, inspections, fluids, and service procedures. Cite this filename + page numbers. If pages are not visible, say so.]`,
      );
    });
    otherPdfs.forEach((p, i) => {
      lines.push(
        `[Other document PDF ${i + 1} (${p.fileName}): wiring, options, scans, or supplementary material. Cite filename + page numbers when possible.]`,
      );
    });
    if (useWeb) {
      lines.push(
        "Use web search as needed for TSBs, recalls, and broader context. Reconcile with these PDFs when they conflict.",
      );
    }

    chunks.push({ type: "text", text: lines.join("\n\n") });
    if (ownerManualPdf) {
      chunks.push({
        type: "file",
        data: ownerManualPdf.buffer,
        mediaType: "application/pdf",
      });
    }
    for (const p of maintenancePdfs) {
      chunks.push({
        type: "file",
        data: p.buffer,
        mediaType: "application/pdf",
      });
    }
    for (const p of otherPdfs) {
      chunks.push({
        type: "file",
        data: p.buffer,
        mediaType: "application/pdf",
      });
    }

    modelMessages.unshift({
      role: "user",
      content: chunks,
    });
  }

  const result = streamText({
    model: getMotivModel(),
    system,
    messages: modelMessages,
    tools: toolsForRequest,
    ...(activeTools !== undefined ? { activeTools } : {}),
    stopWhen: stepCountIs(12),
    onError: ({ error }) => {
      console.error("[api/chat] streamText error:", error);
    },
  });

  return result.toUIMessageStreamResponse();
}
