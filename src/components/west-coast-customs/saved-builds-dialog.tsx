"use client";

import { FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Build } from "@/lib/west-coast-customs/types";
import { useState } from "react";

type Props = {
  builds: Build[];
  onLoad: (build: Build) => void;
  onDelete: (buildId: string) => void;
};

export function SavedBuildsDialog({ builds, onLoad, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="rounded-xl border-border/50" />
        }
      >
        <FolderOpen className="mr-1.5 size-3.5" />
        Builds ({builds.length})
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Saved Builds</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {builds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No saved builds yet.
            </p>
          ) : null}
          {builds.map((build) => (
            <div
              key={build.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{build.name}</p>
                <p className="text-xs text-muted-foreground">
                  {build.selectedPartIds.length} parts &middot;{" "}
                  {new Date(build.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-border/50 text-xs"
                  onClick={() => {
                    onLoad(build);
                    setOpen(false);
                  }}
                >
                  Load
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(build.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
