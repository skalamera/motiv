"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, Manual, ManualKind } from "@/types/database";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import {
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  removeCarImagesFromStorage,
  uploadCarHeroImage,
} from "@/lib/car-image-client";
import { CAR_BODY_TYPES, CAR_DRIVETRAINS } from "@/lib/car-attributes";

export function GarageView() {
  const [cars, setCars] = useState<Car[]>([]);
  const [manuals, setManuals] = useState<Record<string, Manual[]>>({});
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [workshopLibraryKeys, setWorkshopLibraryKeys] = useState<string[]>([]);
  const [workshopLibraryKeysHint, setWorkshopLibraryKeysHint] = useState<
    string | null
  >(null);
  const [form, setForm] = useState({
    year: "",
    make: "",
    model: "",
    trim: "",
    color: "",
    bodyType: "",
    drivetrain: "",
    vin: "",
    mileage: "",
    carLibraryKey: "",
  });
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [savingCar, setSavingCar] = useState(false);
  const [generatingCarId, setGeneratingCarId] = useState<string | null>(null);

  const refreshWorkshopLibraryKeys = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc("list_car_library_keys");
    if (error) {
      setWorkshopLibraryKeys([]);
      setWorkshopLibraryKeysHint(
        "Could not load indexed libraries. Apply the latest Supabase migration or try again.",
      );
      return;
    }
    const rows = (data ?? []) as { library_key: string }[];
    setWorkshopLibraryKeys(
      rows.map((r) => r.library_key).filter((k) => k && k.trim()),
    );
    setWorkshopLibraryKeysHint(null);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: carRows } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (carRows ?? []) as Car[];
    setCars(list);

    const man: Record<string, Manual[]> = {};
    for (const c of list) {
      const { data: m } = await supabase
        .from("manuals")
        .select("*")
        .eq("car_id", c.id);
      man[c.id] = (m ?? []) as Manual[];
    }
    setManuals(man);
    await refreshWorkshopLibraryKeys();
    setLoading(false);
  }, [refreshWorkshopLibraryKeys]);

  /* eslint-disable react-hooks/set-state-in-effect -- bootstrap from Supabase */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function openAdd() {
    setForm({
      year: new Date().getFullYear().toString(),
      make: "",
      model: "",
      trim: "",
      color: "",
      bodyType: "",
      drivetrain: "",
      vin: "",
      mileage: "0",
      carLibraryKey: "",
    });
    setEditCar(null);
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setAddOpen(true);
    void refreshWorkshopLibraryKeys();
  }

  function openEdit(c: Car) {
    setEditCar(c);
    setForm({
      year: String(c.year),
      make: c.make,
      model: c.model,
      trim: c.trim ?? "",
      color: c.color ?? "",
      bodyType: c.body_type ?? "",
      drivetrain: c.drivetrain ?? "",
      vin: c.vin ?? "",
      mileage: String(c.mileage),
      carLibraryKey: c.car_library_key ?? "",
    });
    setPendingImageFile(null);
    setImagePreviewUrl(c.image_url);
    setAddOpen(true);
    void refreshWorkshopLibraryKeys();
  }

  async function saveCar() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      year: parseInt(form.year, 10),
      make: form.make.trim(),
      model: form.model.trim(),
      trim: form.trim.trim() || null,
      color: form.color.trim() || null,
      body_type: form.bodyType.trim() || null,
      drivetrain: form.drivetrain.trim() || null,
      vin: form.vin.trim() || null,
      mileage: parseInt(form.mileage, 10) || 0,
      car_library_key: form.carLibraryKey.trim() || null,
    };

    if (!payload.make || !payload.model || Number.isNaN(payload.year)) {
      alert("Year, make, and model are required.");
      return;
    }

    setSavingCar(true);
    try {
      let carId: string;

      if (editCar) {
        const { error: upErr } = await supabase
          .from("cars")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editCar.id);
        if (upErr) {
          alert(upErr.message);
          return;
        }
        carId = editCar.id;
        if (pendingImageFile) {
          try {
            await uploadCarHeroImage(supabase, {
              userId: user.id,
              carId,
              file: pendingImageFile,
            });
          } catch (e) {
            alert(e instanceof Error ? e.message : "Photo upload failed");
            return;
          }
        }
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("cars")
          .insert({
            user_id: user.id,
            ...payload,
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          alert(insErr?.message ?? "Could not add vehicle");
          return;
        }
        carId = inserted.id;

        if (pendingImageFile) {
          try {
            await uploadCarHeroImage(supabase, {
              userId: user.id,
              carId,
              file: pendingImageFile,
            });
          } catch (e) {
            alert(e instanceof Error ? e.message : "Photo upload failed");
            return;
          }
        } else {
          const genRes = await fetch("/api/cars/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ carId }),
          });
          if (!genRes.ok) {
            const j = (await genRes.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(
              j.error ??
                "Could not generate an AI photo. You can add one later from this vehicle’s card or set GOOGLE_GENERATIVE_AI_API_KEY.",
            );
          }
        }
      }

      setAddOpen(false);
      setPendingImageFile(null);
      setImagePreviewUrl(null);
      await load();
    } finally {
      setSavingCar(false);
    }
  }

  async function regenerateAiPhoto(carId: string) {
    setGeneratingCarId(carId);
    try {
      const res = await fetch("/api/cars/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        alert(
          j.error ??
            "Could not generate image. Check GOOGLE_GENERATIVE_AI_API_KEY and try again.",
        );
        return;
      }
      await load();
    } finally {
      setGeneratingCarId(null);
    }
  }

  async function deleteCar(id: string) {
    if (!confirm("Delete this vehicle and its manuals/schedules?")) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await removeCarImagesFromStorage(supabase, user.id, id);
    }
    await supabase.from("cars").delete().eq("id", id);
    await load();
  }

  async function uploadManual(
    carId: string,
    file: File | null,
    kind: ManualKind,
  ) {
    if (!file) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const lower = file.name.toLowerCase();
    const contentType =
      file.type ||
      (lower.endsWith(".pdf")
        ? "application/pdf"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : lower.endsWith(".png")
            ? "image/png"
            : lower.endsWith(".webp")
              ? "image/webp"
              : lower.endsWith(".gif")
                ? "image/gif"
                : lower.endsWith(".heic")
                  ? "image/heic"
                  : lower.endsWith(".heif")
                    ? "image/heif"
                    : "application/octet-stream");
    const path = `${user.id}/${carId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("manuals")
      .upload(path, file, { contentType });
    if (upErr) {
      alert(upErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("manuals").insert({
      car_id: carId,
      storage_path: path,
      file_name: file.name,
      manual_kind: kind,
    });
    if (insErr) {
      alert(insErr.message);
      return;
    }
    await load();
  }

  async function deleteManual(m: Manual) {
    const supabase = createClient();
    await supabase.storage.from("manuals").remove([m.storage_path]);
    await supabase.from("manuals").delete().eq("id", m.id);
    await load();
  }

  const workshopLibrarySelectOptions = useMemo(() => {
    const set = new Set(workshopLibraryKeys);
    const cur = form.carLibraryKey.trim();
    if (cur) set.add(cur);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workshopLibraryKeys, form.carLibraryKey]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading garage…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Garage</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vehicles, hero photos, workshop libraries, and manuals for Library and AI
          context across Motiv.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Your cars</h2>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            if (!o) {
              setImagePreviewUrl((cur) => {
                if (cur?.startsWith("blob:")) URL.revokeObjectURL(cur);
                return null;
              });
              setPendingImageFile(null);
            }
            setAddOpen(o);
          }}
        >
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add car
          </Button>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editCar ? "Edit car" : "Add car"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mileage</Label>
                <Input
                  type="number"
                  value={form.mileage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mileage: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Make</Label>
                <Input
                  value={form.make}
                  onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                  placeholder="Toyota"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                  placeholder="Camry"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Trim (optional)</Label>
                <Input
                  value={form.trim}
                  onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Exterior color</Label>
                <p className="text-muted-foreground mb-1.5 text-[0.7rem] leading-relaxed">
                  Shown on your dashboard; also used when Motiv generates a hero
                  photo.
                </p>
                <Input
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="e.g. Guards Red, Arctic White, Jet Black"
                />
              </div>
              <div>
                <Label>Body type (optional)</Label>
                <Select
                  value={form.bodyType || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, bodyType: v || "" }))
                  }
                >
                  <SelectTrigger className="bg-background/50 w-full">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" label="Not specified">
                      Not specified
                    </SelectItem>
                    {CAR_BODY_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt} label={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Drivetrain (optional)</Label>
                <Select
                  value={form.drivetrain || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, drivetrain: v || "" }))
                  }
                >
                  <SelectTrigger className="bg-background/50 w-full">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" label="Not specified">
                      Not specified
                    </SelectItem>
                    {CAR_DRIVETRAINS.map((d) => (
                      <SelectItem key={d} value={d} label={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>VIN (optional)</Label>
                <Input
                  value={form.vin}
                  onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Car photo</Label>
                <p className="text-muted-foreground text-[0.7rem] leading-relaxed">
                  Upload your own image, or leave empty:{" "}
                  <strong className="text-foreground font-medium">new vehicles</strong>{" "}
                  get an AI-generated photo from year, make, model, trim, color, body
                  type, and drivetrain (requires{" "}
                  <code className="text-foreground/90">GOOGLE_GENERATIVE_AI_API_KEY</code>
                  ).
                </p>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="border-border/50 bg-muted relative h-28 w-44 overflow-hidden rounded-xl border">
                    {imagePreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- preview URL (blob or public)
                      <img
                        src={imagePreviewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                        <ImageIcon className="size-6 opacity-40" />
                        <span>No photo yet</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <label
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex w-fit cursor-pointer",
                      )}
                    >
                      <Upload className="mr-1.5 size-3.5" />
                      Choose image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          setPendingImageFile(f);
                          setImagePreviewUrl((u) => {
                            if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
                            return URL.createObjectURL(f);
                          });
                        }}
                      />
                    </label>
                    {pendingImageFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setPendingImageFile(null);
                          setImagePreviewUrl((u) => {
                            if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
                            return editCar?.image_url ?? null;
                          });
                        }}
                      >
                        Remove selected file
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Workshop manual library (optional)</Label>
                <p className="text-muted-foreground mb-1.5 text-[0.7rem] leading-relaxed">
                  Indexed HTML under{" "}
                  <code className="text-foreground/90">Car_Libraries/</code> (
                  <code className="text-foreground/90">npm run index-car-library</code>
                  ). Choose a library that exists in your database.
                </p>
                <Select
                  value={form.carLibraryKey.trim() ? form.carLibraryKey : ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, carLibraryKey: v || "" }))
                  }
                >
                  <SelectTrigger className="bg-background/50 w-full font-mono text-xs">
                    <SelectValue placeholder="None — workshop search off" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-1.5rem,36rem)]">
                    <SelectItem value="" label="None">
                      None — workshop search off
                    </SelectItem>
                    {workshopLibrarySelectOptions.map((key) => (
                      <SelectItem key={key} value={key} label={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workshopLibraryKeysHint ? (
                  <p className="text-destructive mt-1.5 text-[0.7rem] leading-relaxed">
                    {workshopLibraryKeysHint}
                  </p>
                ) : workshopLibraryKeys.length === 0 ? (
                  <p className="text-muted-foreground mt-1.5 text-[0.7rem] leading-relaxed">
                    No indexed libraries yet. After indexing completes, reopen this
                    dialog or refresh Garage.
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => void saveCar()}
                disabled={savingCar}
                className="min-w-[5.5rem]"
              >
                {savingCar ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {cars.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cars yet.</p>
        ) : null}
        {cars.map((c) => (
          <Card key={c.id} className="border border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex flex-col gap-0 sm:flex-row">
              <div className="border-border/40 bg-muted/30 relative h-36 shrink-0 overflow-hidden border-b sm:h-full sm:min-h-[11rem] sm:w-44 sm:border-r sm:border-b-0">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
                  <img
                    src={c.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
                    No photo
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {c.year} {c.make} {c.model}
                      {c.trim ? ` ${c.trim}` : ""}
                    </CardTitle>
                    <CardDescription>
                      {c.mileage.toLocaleString()} mi
                      {c.color ? ` · ${c.color}` : ""}
                      {c.body_type ? ` · ${c.body_type}` : ""}
                      {c.drivetrain ? ` · ${c.drivetrain}` : ""}
                      {c.vin ? ` · VIN …${c.vin.slice(-6)}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(c)}
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void deleteCar(c.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 pb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs"
                      disabled={generatingCarId === c.id}
                      onClick={() => void regenerateAiPhoto(c.id)}
                    >
                      {generatingCarId === c.id ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 size-3.5" />
                      )}
                      {c.image_url ? "Regenerate AI photo" : "Generate AI photo"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-xs"
                      onClick={() => openEdit(c)}
                    >
                      Change photo / details
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-xs">
                    Owner&apos;s manual (PDF)
                  </Label>
                  <p className="text-muted-foreground mb-2 text-[0.7rem] leading-relaxed">
                    General reference (warnings, capacities, overview). Used by chat
                    and maintenance tools.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex cursor-pointer",
                      )}
                    >
                      <Upload className="mr-1 inline size-3.5" />
                      Upload PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) =>
                          void uploadManual(
                            c.id,
                            e.target.files?.[0] ?? null,
                            "owner",
                          )
                        }
                      />
                    </label>
                  </div>
                  <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                    {(manuals[c.id] ?? [])
                      .filter((m) => (m.manual_kind ?? "owner") === "owner")
                      .map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{m.file_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-destructive"
                            onClick={() => void deleteManual(m)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <Label className="mb-2 block text-xs">
                    Maintenance / service manual (PDF)
                  </Label>
                  <p className="text-muted-foreground mb-2 text-[0.7rem] leading-relaxed">
                    Scheduled maintenance, inspections, and service procedures.
                    Motiv cross-references this with the owner&apos;s manual in
                    chat and AI maintenance features; cite pages when possible.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex cursor-pointer",
                      )}
                    >
                      <Upload className="mr-1 inline size-3.5" />
                      Upload PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) =>
                          void uploadManual(
                            c.id,
                            e.target.files?.[0] ?? null,
                            "maintenance",
                          )
                        }
                      />
                    </label>
                  </div>
                  <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                    {(manuals[c.id] ?? [])
                      .filter((m) => m.manual_kind === "maintenance")
                      .map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{m.file_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-destructive"
                            onClick={() => void deleteManual(m)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <Label className="mb-2 block text-xs">Other</Label>
                  <p className="text-muted-foreground mb-2 text-[0.7rem] leading-relaxed">
                    Wiring diagrams, option codes, scan logs, photos — anything you
                    want in Library for this car. PDF or common image formats.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex cursor-pointer",
                      )}
                    >
                      <Upload className="mr-1 inline size-3.5" />
                      Upload file
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) =>
                          void uploadManual(
                            c.id,
                            e.target.files?.[0] ?? null,
                            "other",
                          )
                        }
                      />
                    </label>
                  </div>
                  <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                    {(manuals[c.id] ?? [])
                      .filter((m) => m.manual_kind === "other")
                      .map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{m.file_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-destructive"
                            onClick={() => void deleteManual(m)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
                  </div>
                </CardContent>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
