"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Gauge,
  Loader2,
  Send,
  Sparkles,
  Wrench,
  Palette,
  Coins,
} from "lucide-react";
import { CarSelector } from "@/components/car-selector";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function textFromMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function sourcesFromMessage(m: UIMessage): { url: string; title?: string }[] {
  return m.parts
    .filter((p) => p.type === "source-url")
    .map((p) => ({
      url: (p as { url: string }).url,
      title: (p as { title?: string }).title,
    }));
}

const starterPrompts = [
  "I want an Aftermarket Exhaust setup. Please ask me the right questions first.",
  "I want to add Downpipes. Please build a safe, staged plan with costs and links.",
  "I want an ECU Tune. Ask clarifying questions and recommend options with trade-offs.",
  "I want to upgrade Tires for grip and daily comfort. Help me choose size/compound.",
  "Increase horsepower to 500. Ask what you need, then build a complete plan.",
];

const UPGRADES_CHAT_STORAGE_PREFIX = "upgrades-chat";

function storageKeyForCar(carId: string | null): string {
  return `${UPGRADES_CHAT_STORAGE_PREFIX}:${carId ?? "any"}`;
}

export function UpgradesView() {
  const [carId, setCarId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const carIdRef = useRef(carId);
  carIdRef.current = carId;
  const hydrationRef = useRef(false);
  const persistenceKey = useMemo(() => storageKeyForCar(carId), [carId]);
  const chatId = useMemo(() => `upgrades:${carId ?? "any"}`, [carId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          carId: carIdRef.current ?? undefined,
          mode: "upgrades",
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport,
  });
  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    hydrationRef.current = true;
    try {
      const raw = window.localStorage.getItem(persistenceKey);
      if (!raw) {
        setMessages([]);
        return;
      }
      const parsed = JSON.parse(raw) as { messages?: UIMessage[] };
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
    } catch {
      setMessages([]);
    } finally {
      // Let the setState calls apply before enabling persistence writes.
      window.setTimeout(() => {
        hydrationRef.current = false;
      }, 0);
    }
  }, [persistenceKey, setMessages]);

  useEffect(() => {
    if (hydrationRef.current) return;
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(persistenceKey);
        return;
      }
      window.localStorage.setItem(
        persistenceKey,
        JSON.stringify({
          messages,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // Ignore storage quota/private mode errors; chat still works.
    }
  }, [messages, persistenceKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  async function sendStarterPrompt(text: string) {
    if (busy) return;
    await sendMessage({ text });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upgrades</h1>
        <p className="text-muted-foreground text-sm">
          Pick a car and describe your performance or appearance goal. Motiv will
          ask follow-up questions, then build a staged plan with parts, labor,
          costs, and purchase links.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/40 p-3">
        <CarSelector value={carId} onChange={setCarId} />
        <p className="text-muted-foreground mt-2 text-xs">
          Select the exact car so recommendations match fitment and expected
          results.
        </p>
      </div>

      <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="border-border/50 relative min-h-[min(60vh,560px)] flex-1 overflow-hidden rounded-xl border bg-card/30 backdrop-blur-sm">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-4">
              {messages.length === 0 ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="ai-gradient flex size-8 items-center justify-center rounded-lg text-white">
                      <Sparkles className="size-4" />
                    </div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Starter upgrade goals
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendStarterPrompt(prompt)}
                        className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 px-3.5 py-3 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/60 hover:shadow-sm"
                      >
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-accent/70">
                          <Gauge className="size-3.5 text-primary" />
                        </span>
                        <span className="flex-1 text-muted-foreground transition-colors group-hover:text-foreground">
                          {prompt.replace(" Please ask me the right questions first.", "")}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="text-muted-foreground rounded-xl border border-border/50 bg-card/40 p-3 text-xs">
                    Expect Motiv to ask detailed questions about your goal, budget,
                    reliability, emissions/inspection constraints, fuel quality,
                    daily usability, and installation preferences before finalizing
                    recommendations.
                  </div>
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {m.role === "assistant" && (
                    <div className="ai-gradient mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-white">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[90%] text-sm",
                      m.role === "user"
                        ? "ai-gradient rounded-2xl rounded-br-md px-4 py-2.5 text-white shadow-md"
                        : "rounded-2xl rounded-bl-md border border-border/50 bg-card/70 px-4 py-3 backdrop-blur-sm",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="motiv-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {textFromMessage(m)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{textFromMessage(m)}</p>
                    )}

                    {m.role === "assistant" && sourcesFromMessage(m).length > 0 ? (
                      <div className="mt-3 border-t border-border/50 pt-2 text-xs">
                        <p className="text-muted-foreground mb-1 font-medium">
                          Sources
                        </p>
                        <ul className="space-y-1">
                          {sourcesFromMessage(m).map((s, i) => (
                            <li key={i}>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary break-all underline underline-offset-2 hover:text-primary/80"
                              >
                                {s.title ?? s.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {busy ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Motiv is building your upgrade plan…
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <div className="w-full space-y-4 lg:w-[360px]">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="mb-2 text-sm font-medium">Quick goals</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setInput("Increase horsepower to 500")}
              >
                <Wrench className="mr-1.5 size-3.5" />
                500 HP Goal
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setInput("Improve sound and appearance without sacrificing reliability")}
              >
                <Palette className="mr-1.5 size-3.5" />
                Appearance + Sound
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setInput("Give me a budget, balanced, and premium upgrade path")}
              >
                <Coins className="mr-1.5 size-3.5" />
                Multi-Budget Plan
              </Button>
            </div>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card/40 p-3"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Motiv your upgrade goal (e.g., Increase horsepower to 500, track-focused setup, show-car appearance build...)"
              className="min-h-[110px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="sm"
              disabled={busy || !input.trim()}
              className="ai-gradient rounded-xl border-0 text-white"
            >
              <Send className="mr-1.5 size-4" />
              Send to Motiv
            </Button>
            {messages.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(persistenceKey);
                  } catch {
                    // Ignore storage errors.
                  }
                  setMessages([]);
                  setInput("");
                }}
              >
                Clear conversation
              </Button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

