"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageCircle, Send, Loader2, X, Bot } from "lucide-react";
import { ChatSourcesPanel } from "@/components/chat/chat-sources-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatSourcePreferences } from "@/hooks/use-chat-source-preferences";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function textFromMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

type ManualChatFabProps = {
  carId: string;
  manualId: string;
  manualLabel: string;
};

const MANUAL_CHAT_HINT_DISMISSED_KEY = "manual-chat-hint-dismissed";
const MANUAL_CHAT_STORAGE_PREFIX = "manual-chat-conversation";

function storageKeyForManual(carId: string, manualId: string): string {
  return `${MANUAL_CHAT_STORAGE_PREFIX}:${carId}:${manualId}`;
}

export function ManualChatFab({
  carId,
  manualId,
  manualLabel,
}: ManualChatFabProps) {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const carIdRef = useRef(carId);
  const manualIdRef = useRef(manualId);
  carIdRef.current = carId;
  manualIdRef.current = manualId;
  const hydrationRef = useRef(false);
  const persistenceKey = useMemo(
    () => storageKeyForManual(carId, manualId),
    [carId, manualId],
  );
  const chatId = useMemo(
    () => `manual-chat:${carId}:${manualId}`,
    [carId, manualId],
  );

  const { sourcePrefs, setSourcePrefs, sourcePrefsRef, docMeta } =
    useChatSourcePreferences(carId);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          carId: carIdRef.current,
          manualId: manualIdRef.current,
          sourcePreferences: sourcePrefsRef.current,
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport,
  });

  const busy = status === "streaming" || status === "submitted";

  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const dismissed =
        window.localStorage.getItem(MANUAL_CHAT_HINT_DISMISSED_KEY) === "1";
      setShowHint(!dismissed);
    } catch {
      setShowHint(true);
    }
  }, []);

  function dismissHint() {
    setShowHint(false);
    try {
      window.localStorage.setItem(MANUAL_CHAT_HINT_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage failures; still hide for this render.
    }
  }

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    await sendMessage({ text: t });
  }

  return (
    <>
      {showHint && !open ? (
        <div className="border-border/60 bg-popover text-popover-foreground fixed right-24 bottom-9 z-40 max-w-[min(22rem,calc(100vw-7rem))] rounded-xl border px-3 py-2 text-xs shadow-lg">
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss hint"
            className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1.5 rounded p-0.5"
          >
            <X className="size-3.5" />
          </button>
          <p className="pr-5">
            I can help you find what you&apos;re looking for in your owner&apos;s
            manual.
          </p>
        </div>
      ) : null}
      <Button
        type="button"
        size="icon"
        className="ai-gradient glow-primary fixed right-6 bottom-6 z-40 size-14 rounded-full border-0 text-white shadow-xl hover:opacity-95"
        aria-label="Ask about this manual"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="border-border/50 flex flex-row items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <SheetTitle className="text-base">Ask about this manual</SheetTitle>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {manualLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Ask for torque specs, fluid types, fuse locations, or how to reset a
                service light — answers use your uploaded PDF.
              </p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2 text-sm",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role === "assistant" && (
                  <div className="ai-gradient mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-white">
                    <Bot className="size-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[92%] rounded-xl px-3 py-2",
                    m.role === "user"
                      ? "ai-gradient text-white"
                      : "border-border/50 bg-card/80 border",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="motiv-md max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textFromMessage(m)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{textFromMessage(m)}</p>
                  )}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-3.5 animate-spin" />
                Motiv is reading your manual…
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="border-border/50 mt-auto border-t p-3"
          >
            <div className="relative mb-2">
              <ChatSourcesPanel
                carId={carId}
                sourcePrefs={sourcePrefs}
                setSourcePrefs={setSourcePrefs}
                docMeta={docMeta}
                panelSide="top"
              />
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this PDF…"
              className="mb-2 min-h-[72px] resize-none border-0 bg-transparent text-sm"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                  Clear
                </Button>
              ) : null}
              <Button
                type="submit"
                size="sm"
                disabled={busy || !input.trim()}
                className="ai-gradient rounded-xl border-0 text-white"
              >
                <Send className="mr-1.5 size-3.5" />
                Send
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
      </Sheet>
    </>
  );
}
