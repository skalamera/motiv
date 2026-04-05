"use client";

import { useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Square, Loader2, Paperclip } from "lucide-react";
import { CarSelector } from "@/components/car-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function ChatInterface({ initialCarId }: { initialCarId: string | null }) {
  const [carId, setCarId] = useState<string | null>(initialCarId);
  const [queryMode, setQueryMode] = useState<
    "auto" | "maintenance" | "issue" | "visual"
  >("auto");
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          carId: carId ?? undefined,
          queryMode,
        }),
      }),
    [carId, queryMode],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
  });

  const busy = status === "streaming" || status === "submitted";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    const files = fileRef.current?.files;
    if (!text && (!files || files.length === 0)) return;

    setInput("");
    if (fileRef.current) fileRef.current.value = "";

    await sendMessage({
      text: text || "(see attachment)",
      files: files && files.length > 0 ? files : undefined,
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col gap-4 md:h-[calc(100dvh-6rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <CarSelector value={carId} onChange={setCarId} />
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Mode</span>
          <Select
            value={queryMode}
            onValueChange={(v) => setQueryMode(v as typeof queryMode)}
          >
            <SelectTrigger className="bg-background/50 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="maintenance">Maintenance (manual)</SelectItem>
              <SelectItem value="issue">Issue / diagnostics + web</SelectItem>
              <SelectItem value="visual">Photo / video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="glass-card border-border min-h-0 flex-1 rounded-xl border p-4">
        <div className="space-y-4 pr-3">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">
              Ask about maintenance intervals, weird noises, warning lights, or
              upload a photo or short video clip.
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/80 border border-white/5",
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
                  <div className="border-border mt-3 border-t pt-2 text-xs">
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
                            className="text-primary break-all underline"
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
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              Motiv is thinking…
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="glass-card border-border flex flex-col gap-2 rounded-xl border p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the symptom, or ask about your maintenance schedule…"
          className="bg-background/40 min-h-[88px] resize-none border-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit(e);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf"
            multiple
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="mr-1 size-4" />
            Attach
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void stop()}
            >
              <Square className="mr-1 size-3" />
              Stop
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy} className="ml-auto">
            <Send className="mr-1 size-4" />
            Send
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setMessages([])}
          >
            Clear
          </Button>
        </div>
      </form>
    </div>
  );
}
