"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, MaintenanceSchedule } from "@/types/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

function ScheduleRow({
  row,
  car,
  onLogged,
  onDelete,
}: {
  row: MaintenanceSchedule;
  car: Car;
  onLogged: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mileage, setMileage] = useState(String(car.mileage));
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  async function logDone() {
    setSaving(true);
    const supabase = createClient();
    const mi = mileage ? parseInt(mileage, 10) : null;
    const costNum = cost ? parseFloat(cost) : null;
    const { error: logErr } = await supabase.from("maintenance_logs").insert({
      schedule_id: row.id,
      car_id: car.id,
      mileage_at: mi,
      notes: notes || null,
      cost: costNum,
    });
    if (logErr) {
      console.error(logErr);
      setSaving(false);
      return;
    }
    await supabase
      .from("maintenance_schedules")
      .update({
        last_completed_at: new Date().toISOString(),
        last_mileage_at: mi,
      })
      .eq("id", row.id);
    setSaving(false);
    setOpen(false);
    setNotes("");
    setCost("");
    onLogged();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.task}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {row.interval_miles
          ? `${row.interval_miles.toLocaleString()} mi`
          : "—"}
        {row.interval_months ? ` / ${row.interval_months} mo` : ""}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] capitalize">
          {row.source}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[180px] truncate text-xs">
        {row.notes ?? "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setOpen(true)}
            >
              Log done
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log {row.task}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>Odometer (mi)</Label>
                  <Input
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    type="number"
                  />
                </div>
                <div>
                  <Label>Cost (optional)</Label>
                  <Input
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void logDone()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save log"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MaintenanceTracker({ initialCarId }: { initialCarId: string | null }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [schedules, setSchedules] = useState<Record<string, MaintenanceSchedule[]>>(
    {},
  );
  const [tab, setTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newMiles, setNewMiles] = useState("");
  const [newMonths, setNewMonths] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: carRows } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (carRows ?? []) as Car[];
    setCars(list);
    const map: Record<string, MaintenanceSchedule[]> = {};
    for (const car of list) {
      const { data: sch } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("car_id", car.id)
        .order("task");
      map[car.id] = (sch ?? []) as MaintenanceSchedule[];
    }
    setSchedules(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cars.length === 0 || tab) return;
    const first =
      initialCarId && cars.some((c) => c.id === initialCarId)
        ? initialCarId
        : cars[0].id;
    setTab(first);
  }, [cars, tab, initialCarId]);

  async function runGenerate() {
    if (!tab) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/maintenance/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: tab }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? res.statusText);
      }
      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function addCustom() {
    if (!tab || !newTask.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("maintenance_schedules").insert({
      car_id: tab,
      task: newTask.trim(),
      interval_miles: newMiles ? parseInt(newMiles, 10) : null,
      interval_months: newMonths ? parseInt(newMonths, 10) : null,
      is_custom: true,
      source: "custom",
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewTask("");
    setNewMiles("");
    setNewMonths("");
    setAddOpen(false);
    await load();
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Remove this schedule row?")) return;
    const supabase = createClient();
    await supabase.from("maintenance_schedules").delete().eq("id", id);
    await load();
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a vehicle in Settings to build a maintenance schedule.
      </p>
    );
  }

  const active = cars.find((c) => c.id === tab) ?? cars[0];
  const rows = schedules[active.id] ?? [];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollArea className="w-full pb-2">
          <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {cars.map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border px-3 py-1 text-xs"
              >
                {c.year} {c.make} {c.model}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {cars.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void runGenerate()}
                disabled={generating || tab !== c.id}
                variant="default"
              >
                {generating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Auto-populate (AI)
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="mr-2 size-4" />
                  Add row
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Custom maintenance item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Task</Label>
                      <Input
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="e.g. Cabin air filter"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Every (miles)</Label>
                        <Input
                          value={newMiles}
                          onChange={(e) => setNewMiles(e.target.value)}
                          type="number"
                        />
                      </div>
                      <div>
                        <Label>Every (months)</Label>
                        <Input
                          value={newMonths}
                          onChange={(e) => setNewMonths(e.target.value)}
                          type="number"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => void addCustom()}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="glass-card rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground text-center text-sm"
                      >
                        No rows yet. Run auto-populate or add your own.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <ScheduleRow
                        key={row.id}
                        row={row}
                        car={c}
                        onLogged={() => void load()}
                        onDelete={() => void deleteSchedule(row.id)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-muted-foreground text-xs">
              Timeline: completed services update &quot;last done&quot; on each
              row. Refine intervals anytime with custom rows.
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
