"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  uploadProfileAvatar,
  uploadProfileAvatarBlob,
} from "@/lib/profile-avatar-client";
import { Loader2, Sparkles, Upload, UserRound } from "lucide-react";

function base64ToBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

export function ProfileView() {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPhase, setAiPhase] = useState<"prompt" | "preview">("prompt");
  const [aiPrompt, setAiPrompt] = useState("");
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(
    null,
  );
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [pendingMediaType, setPendingMediaType] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (prof) {
      const p = prof as {
        display_name?: string | null;
        location_address?: string | null;
        avatar_url?: string | null;
      };
      setDisplayName(p.display_name ?? "");
      setLocationAddress(p.location_address ?? "");
      setAvatarUrl(p.avatar_url ?? null);
    }
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- bootstrap from Supabase */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function resetAiModal() {
    setAiPhase("prompt");
    setAiPrompt("");
    setLastSubmittedPrompt(null);
    setPendingBase64(null);
    setPendingMediaType(null);
    setAiGenerating(false);
    setAiError(null);
  }

  function handleAiOpenChange(open: boolean) {
    if (!open) resetAiModal();
    setAiOpen(open);
  }

  async function saveProfile() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSavingProfile(true);
    await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        location_address: locationAddress.trim() || null,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    await load();
  }

  async function handleAvatarFile(file: File | null) {
    if (!file) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setAvatarBusy(true);
    try {
      const url = await uploadProfileAvatar(supabase, {
        userId: user.id,
        file,
      });
      setAvatarUrl(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not upload photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function runAiGenerate(promptOverride?: string) {
    const text = (promptOverride ?? aiPrompt).trim();
    if (text.length < 3) {
      setAiError("Please write at least a few words describing your avatar.");
      return;
    }
    setAiError(null);
    setAiGenerating(true);
    try {
      const res = await fetch("/api/profile/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        base64?: string;
        mediaType?: string;
      };
      if (!res.ok) {
        setAiError(j.error ?? "Generation failed");
        return;
      }
      if (!j.base64 || !j.mediaType) {
        setAiError("Unexpected response from server");
        return;
      }
      setLastSubmittedPrompt(text);
      setPendingBase64(j.base64);
      setPendingMediaType(j.mediaType);
      setAiPhase("preview");
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function approveAiAvatar() {
    if (!pendingBase64 || !pendingMediaType) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setAvatarBusy(true);
    try {
      const blob = base64ToBlob(pendingBase64, pendingMediaType);
      const url = await uploadProfileAvatarBlob(supabase, {
        userId: user.id,
        blob,
        contentType: pendingMediaType,
      });
      setAvatarUrl(url);
      handleAiOpenChange(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save avatar");
    } finally {
      setAvatarBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  const previewDataUrl =
    pendingBase64 && pendingMediaType
      ? `data:${pendingMediaType};base64,${pendingBase64}`
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          How you appear across Motiv and where you are based for local features.
        </p>
      </div>

      <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Shown across Motiv.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Profile photo</Label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="border-border/50 bg-muted/40 relative size-28 shrink-0 overflow-hidden rounded-full border">
                {avatarBusy && !previewDataUrl ? (
                  <div className="flex size-full items-center justify-center">
                    <Loader2 className="text-muted-foreground size-8 animate-spin" />
                  </div>
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user URL from storage
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center">
                    <UserRound className="size-12 opacity-40" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Upload an image from your device or generate an AI avatar from a
                  short description.
                </p>
                <div className="flex flex-wrap gap-2">
                  <label
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex cursor-pointer",
                    )}
                  >
                    <Upload className="mr-1.5 size-3.5" />
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void handleAvatarFile(f);
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-lg"
                    onClick={() => {
                      resetAiModal();
                      setAiOpen(true);
                    }}
                  >
                    <Sparkles className="mr-1.5 size-3.5" />
                    AI Avatar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background/50 mt-1.5 max-w-md"
            />
          </div>
          <div>
            <Label htmlFor="location-address">Location</Label>
            <p className="text-muted-foreground mb-1.5 text-xs">
              Your home address or neighborhood. Used for Local Drives suggestions
              and Cars & Coffee region.
            </p>
            <Textarea
              id="location-address"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Asheville, NC 28801"
              className="bg-background/50 min-h-[88px] max-w-md resize-y"
            />
          </div>
          <Button onClick={() => void saveProfile()} disabled={savingProfile}>
            {savingProfile ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save profile"
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={aiOpen} onOpenChange={handleAiOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          {aiPhase === "prompt" ? (
            <>
              <DialogHeader>
                <DialogTitle>AI avatar</DialogTitle>
                <DialogDescription>
                  In one or two sentences, describe the avatar you want (style,
                  subject, mood, colors — e.g. “friendly cartoon mechanic with a
                  vintage cap” or “minimal geometric fox in sunset colors”).
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your ideal profile image…"
                className="bg-background/50 min-h-[100px] resize-y"
                disabled={aiGenerating}
              />
              {aiError ? (
                <p className="text-destructive text-sm">{aiError}</p>
              ) : null}
              <DialogFooter className="border-t-0 bg-transparent p-0 pt-0 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAiOpenChange(false)}
                  disabled={aiGenerating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={aiGenerating || aiPrompt.trim().length < 3}
                  onClick={() => void runAiGenerate()}
                >
                  {aiGenerating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Review your avatar</DialogTitle>
                <DialogDescription>
                  If you like it, confirm to use it as your profile photo. You can
                  also try again with the same or a new prompt.
                </DialogDescription>
              </DialogHeader>
              <div className="border-border/50 bg-muted/30 relative flex min-h-[16rem] items-center justify-center rounded-xl border p-4">
                {previewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline AI preview
                  <img
                    src={previewDataUrl}
                    alt="Generated avatar preview"
                    className={cn(
                      "max-h-64 w-64 rounded-full object-cover shadow-md",
                      aiGenerating && "opacity-40",
                    )}
                  />
                ) : null}
                {aiGenerating ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40">
                    <Loader2 className="text-primary size-12 animate-spin" />
                  </div>
                ) : null}
              </div>
              <DialogFooter className="flex-col gap-2 border-t-0 bg-transparent p-0 sm:flex-col sm:space-x-0">
                <Button
                  type="button"
                  className="w-full sm:w-full"
                  disabled={avatarBusy || !pendingBase64}
                  onClick={() => void approveAiAvatar()}
                >
                  {avatarBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Approve and use this image"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-full"
                  disabled={aiGenerating || !lastSubmittedPrompt}
                  onClick={() => void runAiGenerate(lastSubmittedPrompt ?? undefined)}
                >
                  {aiGenerating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Regenerate with same prompt"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-full"
                  disabled={aiGenerating}
                  onClick={() => {
                    setAiPhase("prompt");
                    setPendingBase64(null);
                    setPendingMediaType(null);
                    setAiError(null);
                  }}
                >
                  Edit prompt and regenerate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground w-full sm:w-full"
                  onClick={() => handleAiOpenChange(false)}
                >
                  Cancel and close
                </Button>
              </DialogFooter>
              {aiError ? (
                <p className="text-destructive text-center text-sm">{aiError}</p>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
