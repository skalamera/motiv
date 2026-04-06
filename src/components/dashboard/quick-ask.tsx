"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Car } from "@/types/database";
import { cn } from "@/lib/utils";

const prompts = [
  {
    text: "How do I know when to change my brake pads?",
    icon: Wrench,
    color: "text-orange-400",
  },
  {
    text: "My check engine light came on — what should I do?",
    icon: AlertTriangle,
    color: "text-amber-400",
  },
];

export function QuickAsk() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [carsLoading, setCarsLoading] = useState(true);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setCars(data as Car[]);
        setCarsLoading(false);
      });
  }, []);

  function carDisplayName(c: Car): string {
    return [c.year, c.make, c.model, c.trim].filter(Boolean).join(" ");
  }

  function go(text: string, carId?: string | null) {
    const params = new URLSearchParams({ q: text.trim() });
    if (carId) params.set("car", carId);
    router.push(`/chat?${params.toString()}`);
  }

  function onQuickPromptClick(text: string) {
    setPendingPrompt(text);
    setSelectedCarId(null);
    setPromptDialogOpen(true);
  }

  function continueWithSelectedCar() {
    if (!pendingPrompt) return;
    go(pendingPrompt, selectedCarId);
    setPromptDialogOpen(false);
    setPendingPrompt(null);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="ai-gradient flex size-7 items-center justify-center rounded-lg text-white">
            <Bot className="size-4" />
          </div>
          <h2 className="text-base font-semibold tracking-tight">
            Ask Motiv About Your Car
          </h2>
        </div>

        {/* Inline search bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) go(input);
          }}
          className="relative"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card/50 px-4 py-3 shadow-sm backdrop-blur-sm transition-all focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
            <Sparkles className="size-4 shrink-0 text-primary/60" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your car…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className={cn(
                "ai-gradient size-8 shrink-0 rounded-xl border-0 text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-30",
              )}
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </form>

        {/* Prompt chips */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prompts.map((p, i) => (
            <motion.button
              key={p.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              type="button"
              onClick={() => onQuickPromptClick(p.text)}
              className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 px-3.5 py-3 text-left text-sm transition-all hover:border-primary/30 hover:bg-accent/60 hover:shadow-sm"
            >
              <p.icon
                className={cn(
                  "mt-0.5 size-4 shrink-0 transition-colors",
                  p.color,
                )}
              />
              <span className="flex-1 text-muted-foreground transition-colors group-hover:text-foreground">
                {p.text}
              </span>
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </motion.button>
          ))}
        </div>
      </motion.div>

      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which car is this about?</DialogTitle>
            <DialogDescription>
              {pendingPrompt
                ? `Question: "${pendingPrompt}"`
                : "Pick a vehicle to give Motiv better context."}
            </DialogDescription>
          </DialogHeader>

          {carsLoading ? (
            <div className="bg-muted h-9 animate-pulse rounded-md" />
          ) : cars.length > 0 ? (
            <Select
              value={selectedCarId ?? ""}
              onValueChange={(v) => setSelectedCarId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any / not specified</SelectItem>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {carDisplayName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-muted-foreground text-sm">
              No vehicles found. You can continue without selecting one.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPromptDialogOpen(false);
                setPendingPrompt(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={continueWithSelectedCar}>
              Continue to chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
