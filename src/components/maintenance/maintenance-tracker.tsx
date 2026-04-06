"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Car, MaintenanceSchedule } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useCarSelection } from "@/hooks/use-car-selection";

type ServiceLogRow = {
  id: string;
  completed_at: string;
  mileage_at: number | null;
  notes: string | null;
  cost: number | null;
  taskLabel: string;
  title: string | null;
  schedule_id: string | null;
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
  onUpdated,
}: {
  row: MaintenanceSchedule;
  car: Car;
  onLogged: () => void;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mileage, setMileage] = useState(String(car.mileage));
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState(row.task);
  const [editMiles, setEditMiles] = useState(row.interval_miles ? String(row.interval_miles) : "");
  const [editMonths, setEditMonths] = useState(row.interval_months ? String(row.interval_months) : "");
  const [editNotes, setEditNotes] = useState(row.notes || "");
  const [editSaving, setEditSaving] = useState(false);

  function openEditModal() {
    setEditTask(row.task);
    setEditMiles(row.interval_miles ? String(row.interval_miles) : "");
    setEditMonths(row.interval_months ? String(row.interval_months) : "");
    setEditNotes(row.notes || "");
    setEditOpen(true);
  }

  async function logDone(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
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

  async function saveEdit() {
    setEditSaving(true);
    const supabase = createClient();
    const miParsed = editMiles.trim() ? parseInt(editMiles, 10) : null;
    const moParsed = editMonths.trim() ? parseInt(editMonths, 10) : null;

    const { error } = await supabase
      .from("maintenance_schedules")
      .update({
        task: editTask.trim(),
        interval_miles: miParsed,
        interval_months: moParsed,
        notes: editNotes.trim() || null,
      })
      .eq("id", row.id);

    setEditSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditOpen(false);
    onUpdated();
  }

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50" 
        onClick={() => openEditModal()}
      >
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
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              Log done
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={(e) => void logDone(e)} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save log"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Schedule Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Task</Label>
              <Input
                value={editTask}
                onChange={(e) => setEditTask(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Every (miles)</Label>
                <Input
                  value={editMiles}
                  onChange={(e) => setEditMiles(e.target.value)}
                  type="number"
                />
              </div>
              <div>
                <Label>Every (months)</Label>
                <Input
                  value={editMonths}
                  onChange={(e) => setEditMonths(e.target.value)}
                  type="number"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveEdit()} disabled={editSaving || !editTask.trim()}>
                {editSaving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryRow({
  log,
  onUpdated,
  onDelete,
}: {
  log: ServiceLogRow;
  onUpdated: () => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(log.title || "");
  const [editDate, setEditDate] = useState(() => {
    if (!log.completed_at) return todayYmd();
    try {
      return log.completed_at.split("T")[0];
    } catch {
      return todayYmd();
    }
  });
  const [editMileage, setEditMileage] = useState(log.mileage_at ? String(log.mileage_at) : "");
  const [editCost, setEditCost] = useState(log.cost ? String(log.cost) : "");
  const [editNotes, setEditNotes] = useState(log.notes || "");
  const [saving, setSaving] = useState(false);

  function openEditModal() {
    setEditTitle(log.title || "");
    try {
      setEditDate(log.completed_at ? log.completed_at.split("T")[0] : todayYmd());
    } catch {
      setEditDate(todayYmd());
    }
    setEditMileage(log.mileage_at ? String(log.mileage_at) : "");
    setEditCost(log.cost ? String(log.cost) : "");
    setEditNotes(log.notes || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    setSaving(true);
    const supabase = createClient();
    const miParsed = editMileage.trim() ? parseInt(editMileage, 10) : null;
    const costParsed = editCost.trim() ? parseFloat(editCost) : null;

    const { error } = await supabase
      .from("maintenance_logs")
      .update({
        title: editTitle.trim() || null,
        completed_at: localDateToNoonIso(editDate),
        mileage_at: miParsed,
        cost: costParsed,
        notes: editNotes.trim() || null,
      })
      .eq("id", log.id);

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditOpen(false);
    onUpdated();
  }

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => openEditModal()}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Service Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Service / task name</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={log.schedule_id ? "Leave blank to use schedule task name" : "e.g. Tire patch"}
              />
              {log.schedule_id && !editTitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  Using schedule name: {log.taskLabel}
                </p>
              )}
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Odometer (mi)</Label>
              <Input
                type="number"
                value={editMileage}
                onChange={(e) => setEditMileage(e.target.value)}
              />
            </div>
            <div>
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this service log?")) {
                  setEditOpen(false);
                  onDelete();
                }
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving || (!editTitle.trim() && !log.schedule_id)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MaintenanceTracker({ initialCarId }: { initialCarId: string | null }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [schedules, setSchedules] = useState<Record<string, MaintenanceSchedule[]>>(
    {},
  );
  const [logsByCar, setLogsByCar] = useState<Record<string, ServiceLogRow[]>>({});
  const [tab, setTab] = useCarSelection("");
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
          schedule_id,
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
        schedule_id: string | null;
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
          title: row.title,
          schedule_id: row.schedule_id,
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
    if (cars.length === 0) return;
    
    // Default to the first car (if there's only 1, this acts as the auto-select)
    // Or if the initialCarId is valid
    if (!tab || !cars.some(c => c.id === tab)) {
      const first =
        initialCarId && cars.some((c) => c.id === initialCarId)
          ? initialCarId
          : cars[0].id;
      setTab(first);
    }
  }, [cars, tab, initialCarId, setTab]);

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

  async function deleteLog(id: string) {
    const supabase = createClient();
    await supabase.from("maintenance_logs").delete().eq("id", id);
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
      <div className="flex justify-between items-center mb-4">
        <Select value={tab} onValueChange={(val) => val && setTab(val)}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a car" />
          </SelectTrigger>
          <SelectContent>
            {cars.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.year} {c.make} {c.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runGenerate()}
            disabled={generating}
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
                    car={active}
                    onLogged={() => void load()}
                    onDelete={() => void deleteSchedule(row.id)}
                    onUpdated={() => void load()}
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
              onClick={() => openManualLog(active)}
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
                  <HistoryRow
                    key={log.id}
                    log={log}
                    onUpdated={() => void load()}
                    onDelete={() => void deleteLog(log.id)}
                  />
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
      </div>

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
              <Textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Parts, shop name, warranty…"
                rows={3}
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
