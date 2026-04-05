"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, Manual } from "@/types/database";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";

export function SettingsView() {
  const [cars, setCars] = useState<Car[]>([]);
  const [manuals, setManuals] = useState<Record<string, Manual[]>>({});
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [form, setForm] = useState({
    year: "",
    make: "",
    model: "",
    trim: "",
    vin: "",
    mileage: "",
  });

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
      setDisplayName(
        (prof as { display_name?: string | null }).display_name ?? "",
      );
    }

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
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- bootstrap from Supabase */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function saveProfile() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSavingProfile(true);
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName || null,
    });
    setSavingProfile(false);
    await load();
  }

  function openAdd() {
    setForm({
      year: new Date().getFullYear().toString(),
      make: "",
      model: "",
      trim: "",
      vin: "",
      mileage: "0",
    });
    setEditCar(null);
    setAddOpen(true);
  }

  function openEdit(c: Car) {
    setEditCar(c);
    setForm({
      year: String(c.year),
      make: c.make,
      model: c.model,
      trim: c.trim ?? "",
      vin: c.vin ?? "",
      mileage: String(c.mileage),
    });
    setAddOpen(true);
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
      vin: form.vin.trim() || null,
      mileage: parseInt(form.mileage, 10) || 0,
    };

    if (editCar) {
      await supabase.from("cars").update(payload).eq("id", editCar.id);
    } else {
      await supabase.from("cars").insert({
        user_id: user.id,
        ...payload,
      });
    }
    setAddOpen(false);
    await load();
  }

  async function deleteCar(id: string) {
    if (!confirm("Delete this vehicle and its manuals/schedules?")) return;
    const supabase = createClient();
    await supabase.from("cars").delete().eq("id", id);
    await load();
  }

  async function uploadManual(carId: string, file: File | null) {
    if (!file) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${carId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("manuals")
      .upload(path, file, { contentType: file.type || "application/pdf" });
    if (upErr) {
      alert(upErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("manuals").insert({
      car_id: carId,
      storage_path: path,
      file_name: file.name,
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

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Profile, vehicles, and owner&apos;s manual PDFs for AI context.
        </p>
      </div>

      <Card className="glass-card border-white/10 bg-card/40">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Shown across Motiv.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background/50 max-w-md"
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

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Your cars</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
                <Label>VIN (optional)</Label>
                <Input
                  value={form.vin}
                  onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void saveCar()}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {cars.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cars yet.</p>
        ) : null}
        {cars.map((c) => (
          <Card key={c.id} className="glass-card border-white/10 bg-card/40">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {c.year} {c.make} {c.model}
                  {c.trim ? ` ${c.trim}` : ""}
                </CardTitle>
                <CardDescription>
                  {c.mileage.toLocaleString()} mi
                  {c.vin ? ` · VIN …${c.vin.slice(-6)}` : ""}
                </CardDescription>
              </div>
              <div className="flex gap-1">
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
              <Separator />
              <div>
                <Label className="mb-2 block text-xs">Owner&apos;s manual (PDF)</Label>
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
                        void uploadManual(c.id, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
                <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                  {(manuals[c.id] ?? []).map((m) => (
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
