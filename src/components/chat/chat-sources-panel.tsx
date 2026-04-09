"use client";

import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FolderOpen,
  Globe,
  LibraryBig,
  ListFilter,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CarDocMeta } from "@/hooks/use-chat-source-preferences";
import type { ChatSourcePreferences } from "@/types/chat-sources";
import { cn } from "@/lib/utils";

function SourceToggleRow({
  label,
  available,
  on,
  onToggle,
  icon: Icon,
}: {
  label: string;
  available: boolean;
  on: boolean;
  onToggle: () => void;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-2 py-2",
        !available && "opacity-50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-foreground text-sm leading-tight">{label}</div>
          {!available ? (
            <p className="text-muted-foreground mt-0.5 text-[0.65rem] leading-snug">
              Not on file
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? "on" : "off"}`}
        disabled={!available}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (available) onToggle();
        }}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          on ? "bg-primary" : "bg-muted",
          !available && "cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            on && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

type Props = {
  carId: string | null;
  sourcePrefs: ChatSourcePreferences;
  setSourcePrefs: React.Dispatch<React.SetStateAction<ChatSourcePreferences>>;
  docMeta: CarDocMeta | null;
  /** Open upward (composer at bottom) vs downward */
  panelSide?: "top" | "bottom";
};

/**
 * Glean-style source toggles without Menu/Dropdown primitives (avoids Base UI crashes with nested buttons).
 */
export function ChatSourcesPanel({
  carId,
  sourcePrefs,
  setSourcePrefs,
  docMeta,
  panelSide = "top",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="rounded-xl text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <ListFilter className="mr-1.5 size-4" />
        Sources
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose sources for the next reply"
          className={cn(
            "border-border/60 bg-popover text-popover-foreground absolute z-[200] w-[min(100vw-2rem,20rem)] rounded-xl border p-0 shadow-lg ring-1 ring-foreground/10",
            panelSide === "top"
              ? "bottom-full left-0 mb-1"
              : "top-full left-0 mt-1",
          )}
        >
          <p className="text-muted-foreground px-3 pt-3 pb-1 text-[0.65rem] font-medium tracking-wide uppercase">
            Use for the next reply
          </p>
          <div className="border-border/50 space-y-0.5 border-t px-1 py-2">
            <SourceToggleRow
              label="Web"
              icon={Globe}
              available
              on={sourcePrefs.web}
              onToggle={() =>
                setSourcePrefs((p) => ({ ...p, web: !p.web }))
              }
            />
            <SourceToggleRow
              label="Owner’s manual"
              icon={BookOpen}
              available={carId ? !!docMeta?.hasOwner : false}
              on={sourcePrefs.owner}
              onToggle={() =>
                setSourcePrefs((p) => ({ ...p, owner: !p.owner }))
              }
            />
            <SourceToggleRow
              label="Service manual"
              icon={Wrench}
              available={carId ? !!docMeta?.hasService : false}
              on={sourcePrefs.service}
              onToggle={() =>
                setSourcePrefs((p) => ({ ...p, service: !p.service }))
              }
            />
            <SourceToggleRow
              label="Other docs"
              icon={FolderOpen}
              available={carId ? !!docMeta?.hasOther : false}
              on={sourcePrefs.otherDocs}
              onToggle={() =>
                setSourcePrefs((p) => ({ ...p, otherDocs: !p.otherDocs }))
              }
            />
            <SourceToggleRow
              label="Workshop manual"
              icon={LibraryBig}
              available={carId ? !!docMeta?.hasWorkshop : false}
              on={sourcePrefs.workshop}
              onToggle={() =>
                setSourcePrefs((p) => ({ ...p, workshop: !p.workshop }))
              }
            />
          </div>
          {!carId ? (
            <p className="text-muted-foreground border-border/50 border-t px-3 py-2 text-[0.65rem] leading-relaxed">
              Select a vehicle to enable manual, other docs, and workshop manual
              sources.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
