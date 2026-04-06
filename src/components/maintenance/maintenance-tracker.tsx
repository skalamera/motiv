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

type ServiceLogRow = {
  id: string;
  completed_at: string;
  mileage_at: number | null;
  notes: string | null;
  cost: number | null;
  taskLabel: string;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function localDateToNoonIso(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function todayYmd(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
      title: row.task,
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
      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
        {formatShortDate(row.last_completed_at)}
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
  const [logsByCar, setLogsByCar] = useState<Record<string, ServiceLogRow[]>>({});
  const [tab, setTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newMiles, setNewMiles] = useState("");
  const [newMonths, setNewMonths] = useState("");

  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [manualCarId, setManualCarId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDate, setManualDate] = useState(todayYmd);
  const [manualMileage, setManualMileage] = useState("");
  const [manualCost, setManualCost] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const openManualLog = useCallback(
    (car: Car) => {
      setManualCarId(car.id);
      setManualTitle("");
      setManualDate(todayYmd());
      setManualMileage(String(car.mileage));
      setManualCost("");
      setManualNotes("");
      setManualLogOpen(true);
    },
    [],
  );

  async function saveManualLog() {
    if (!manualCarId || !manualTitle.trim()) return;
    setManualSaving(true);
    const supabase = createClient();
    const miParsed = manualMileage.trim()
      ? parseInt(manualMileage, 10)
      : NaN;
    const costParsed = manualCost.trim()
      ? parseFloat(manualCost)
      : NaN;
    const { error } = await supabase.from("maintenance_logs").insert({
      schedule_id: null,
      car_id: manualCarId,
      title: manualTitle.trim(),
      completed_at: localDateToNoonIso(manualDate),
      mileage_at: Number.isFinite(miParsed) ? miParsed : null,
      notes: manualNotes.trim() || null,
      cost: Number.isFinite(costParsed) ? costParsed : null,
    });
    setManualSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setManualLogOpen(false);
    await load();
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: carRows } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (carRows ?? []) as Car[];
    setCars(list);
    const map: Record<string, MaintenanceSchedule[]> = {};
    const logsMap: Record<string, ServiceLogRow[]> = {};
    for (const car of list) {
      const { data: sch } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("car_id", car.id)
        .order("task");
      map[car.id] = (sch ?? []) as MaintenanceSchedule[];

      const { data: logRows } = await supabase
        .from("maintenance_logs")
        .select(
          `
          id,
          completed_at,
          mileage_at,
          notes,
          cost,
          title,
          maintenance_schedules ( task )
        `,
        )
        .eq("car_id", car.id)
        .order("completed_at", { ascending: false })
        .limit(100);

      type LogJoin = {
        id: string;
        completed_at: string;
        mileage_at: number | null;
        notes: string | null;
        cost: number | null;
        title: string | null;
        maintenance_schedules: { task: string } | null;
      };

      logsMap[car.id] = (logRows ?? []).map((raw) => {
        const row = raw as unknown as LogJoin;
        const fromSchedule = row.maintenance_schedules?.task?.trim();
        const fromTitle = row.title?.trim();
        return {
          id: row.id,
          completed_at: row.completed_at,
          mileage_at: row.mileage_at,
          notes: row.notes,
          cost: row.cost,
          taskLabel: fromSchedule || fromTitle || "Service",
        };
      });
    }
    setSchedules(map);
    setLogsByCar(logsMap);
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
  const historyRows = logsByCar[active.id] ?? [];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollArea className="w-full pb-2">
          <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {cars.map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 rounded-full border border-border/50 px-3 py-1 text-xs transition-all"
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
                className="ai-gradient glow-primary rounded-xl border-0 text-white shadow-md hover:opacity-90 disabled:opacity-50"
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

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Last done</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
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

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="border-border/50 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Service history
                  </h3>
                  <p className="text-muted-foreground mt-0.5 max-w-xl text-xs">
                    <strong className="text-foreground font-medium">Log done</strong> on a
                    task above, or{" "}
                    <strong className="text-foreground font-medium">add a manual entry</strong>{" "}
                    for work that isn&apos;t on your schedule. Separate from what&apos;s due
                    next.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => openManualLog(c)}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Add manual log
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className="max-w-[200px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No services logged yet. Use{" "}
                        <span className="text-foreground font-medium">Log done</span> or{" "}
                        <span className="text-foreground font-medium">Add manual log</span>.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyRows.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatShortDate(log.completed_at)}
                        </TableCell>
                        <TableCell className="font-medium">{log.taskLabel}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.mileage_at != null
                            ? `${log.mileage_at.toLocaleString()} mi`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.cost != null
                            ? `$${Number(log.cost).toFixed(2)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
                          {log.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-muted-foreground text-xs">
              Logging from the schedule updates the{" "}
              <strong className="text-foreground font-medium">Last done</strong> column for
              that task. Manual entries only appear in history. Refine intervals anytime
              with custom rows.
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={manualLogOpen} onOpenChange={setManualLogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add manual service log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Service / task name</Label>
              <Input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g. Tire patch at Discount Tire"
                autoFocus
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Odometer (mi)</Label>
              <Input
                type="number"
                value={manualMileage}
                onChange={(e) => setManualMileage(e.target.value)}
              />
            </div>
            <div>
              <Label>Cost (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Parts, shop name, warranty…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualLogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveManualLog()}
              disabled={manualSaving || !manualTitle.trim()}
            >
              {manualSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save log"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
