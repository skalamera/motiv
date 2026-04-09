"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isFileUIPart,
  isTextUIPart,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Square,
  Loader2,
  Paperclip,
  Sparkles,
  Bot,
  X,
  FileText,
  Film,
} from "lucide-react";
import { CarSelector } from "@/components/car-selector";
import { ChatSourcesPanel } from "@/components/chat/chat-sources-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatSourcePreferences } from "@/hooks/use-chat-source-preferences";
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

function UserMessageContent({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => {
        if (isTextUIPart(part) && part.text.trim()) {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {part.text}
            </p>
          );
        }
        if (isFileUIPart(part)) {
          const label = part.filename ?? "Attachment";
          if (part.mediaType.startsWith("image/")) {
            return (
              // eslint-disable-next-line @next/next/no-img-element -- data URLs from chat attachments
              <img
                key={i}
                src={part.url}
                alt={label}
                className="max-h-52 max-w-full rounded-lg object-contain"
              />
            );
          }
          if (part.mediaType.startsWith("video/")) {
            return (
              <video
                key={i}
                src={part.url}
                controls
                className="max-h-52 max-w-full rounded-lg"
              >
                {label}
              </video>
            );
          }
          return (
            <p key={i} className="text-xs opacity-90">
              {label}
              <span className="text-muted-foreground"> · {part.mediaType}</span>
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

function fileListFromFiles(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) {
    dt.items.add(f);
  }
  return dt.files;
}

const CHAT_STORAGE_PREFIX = "chat-conversation";

function storageKeyForCar(carId: string | null): string {
  return `${CHAT_STORAGE_PREFIX}:${carId ?? "any"}`;
}

export function ChatInterface({ initialCarId, initialQuery }: { initialCarId: string | null; initialQuery?: string | null }) {
  const [carId, setCarId] = useState<string | null>(initialCarId);
  const [input, setInput] = useState("");
  /** Snapshot of picked files; never clear the input before sendMessage finishes (FileList becomes empty). */
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrationRef = useRef(false);

  const imagePreviewUrls = useMemo(() => {
    return attachedFiles.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    );
  }, [attachedFiles]);

  useEffect(() => {
    return () => {
      for (const u of imagePreviewUrls) {
        if (u) URL.revokeObjectURL(u);
      }
    };
  }, [imagePreviewUrls]);

  /**
   * useChat keeps the first Chat + transport instance forever. A transport whose
   * body() closes over `carId` from render would stay stuck on the initial value.
   */
  const carIdRef = useRef(carId);
  carIdRef.current = carId;

  useEffect(() => {
    setCarId(initialCarId);
  }, [initialCarId]);

  const { sourcePrefs, setSourcePrefs, sourcePrefsRef, docMeta } =
    useChatSourcePreferences(carId);

  const persistenceKey = useMemo(() => storageKeyForCar(carId), [carId]);
  const chatId = useMemo(() => `chat:${carId ?? "any"}`, [carId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          carId: carIdRef.current ?? undefined,
          sourcePreferences: sourcePrefsRef.current,
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages, error, clearError } =
    useChat({
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

  /* Auto-send an initial query passed via ?q= from the dashboard */
  const didAutoSend = useRef(false);
  useEffect(() => {
    if (initialQuery && !didAutoSend.current && messages.length === 0) {
      didAutoSend.current = true;
      void sendMessage({ text: initialQuery });
    }
  }, [initialQuery, messages.length, sendMessage]);

  const clearAttachments = useCallback(() => {
    setAttachedFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (fileRef.current) {
        fileRef.current.files = fileListFromFiles(next);
      }
      return next;
    });
  }, []);

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    setAttachedFiles(list ? Array.from(list) : []);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;

    const toSend =
      attachedFiles.length > 0 ? fileListFromFiles(attachedFiles) : undefined;

    setInput("");
    clearAttachments();

    await sendMessage({
      text: text || "(see attachment)",
      files: toSend,
    });
  }

  const suggestions = [
    "When is my next oil change due?",
    "My engine is making a ticking noise",
    "What does the check engine light mean?",
    "Explain my recall notices",
  ];

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col gap-4 md:h-[calc(100dvh-6rem)]">
      <div className="flex flex-col gap-2">
        <CarSelector value={carId} onChange={setCarId} />
        <p className="text-muted-foreground text-xs">
          Choose a vehicle, then use <strong className="text-foreground/80">Sources</strong>{" "}
          below to include web, manuals, other docs, and workshop manual—when they&apos;re on
          file.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm">
        <div className="space-y-5 pr-3">
          {error ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 leading-snug">
                  <span className="font-medium">Couldn&apos;t get a reply.</span>{" "}
                  {error.message}
                </p>
                <button
                  type="button"
                  onClick={() => clearError()}
                  className="text-destructive/80 hover:text-destructive shrink-0 rounded-md px-1.5 py-0.5 text-xs underline"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-destructive/85 text-xs leading-relaxed">
                If this keeps happening, check the Vercel deployment logs for{" "}
                <code className="rounded bg-black/10 px-1 py-px font-mono text-[0.65rem]">
                  /api/chat
                </code>
                . Large PDF manuals or AI Gateway limits can also cut the stream short.
              </p>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-16">
              <div className="ai-gradient flex size-14 items-center justify-center rounded-2xl text-white shadow-lg">
                <Sparkles className="size-7" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold tracking-tight">Ask Motiv anything</h2>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  Maintenance, diagnostics, warning lights—or send a photo or clip and we&apos;ll work from that too.
                </p>
              </div>
              <div className="grid w-full max-w-md grid-cols-2 gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setInput(s); }}
                    className="rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
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
                  "max-w-[85%] text-sm",
                  m.role === "user"
                    ? "ai-gradient rounded-2xl rounded-br-md px-4 py-2.5 text-white shadow-md"
                    : "rounded-2xl rounded-bl-md border border-border/50 bg-card/60 px-4 py-3 backdrop-blur-sm",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="motiv-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {textFromMessage(m)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <UserMessageContent message={m} />
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
            <div className="flex items-center gap-3">
              <div className="ai-gradient ai-thinking flex size-7 items-center justify-center rounded-lg text-white">
                <Bot className="size-4" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Motiv is thinking…
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-lg backdrop-blur-sm"
      >
        {attachedFiles.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-1 pt-1">
            {attachedFiles.map((file, i) => (
              <li
                key={`${file.name}-${file.size}-${i}`}
                className="border-border/60 bg-card/80 relative flex items-center gap-2 rounded-xl border px-2 py-1.5 pr-8 text-xs"
              >
                {file.type.startsWith("image/") && imagePreviewUrls[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img
                    src={imagePreviewUrls[i]!}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                ) : file.type.startsWith("video/") ? (
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <Film className="text-muted-foreground size-5" />
                  </div>
                ) : (
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <FileText className="text-muted-foreground size-5" />
                  </div>
                )}
                <span className="max-w-[180px] truncate font-medium" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute top-1 right-1 rounded-md p-0.5"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything—or attach a photo, video, or PDF…"
          className="min-h-[88px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
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
            onChange={onFileInputChange}
          />
          <ChatSourcesPanel
            carId={carId}
            sourcePrefs={sourcePrefs}
            setSourcePrefs={setSourcePrefs}
            docMeta={docMeta}
            panelSide="top"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="mr-1.5 size-4" />
            Attach
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={() => void stop()}
            >
              <Square className="mr-1 size-3" />
              Stop
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy} className="ai-gradient glow-primary ml-auto rounded-xl border-0 text-white shadow-md hover:opacity-90 disabled:opacity-50">
            <Send className="mr-1.5 size-4" />
            Send
          </Button>
          {messages.length > 0 && (
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
                clearAttachments();
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
