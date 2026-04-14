"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Camera,
  Loader2,
  Plus,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCarSelection } from "@/hooks/use-car-selection";
import { computeSuggestedNextMaintenance } from "@/lib/maintenance/suggested-next";

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

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Prefixed to notes when DB has not migrated `user_provided` source yet (fallback insert). */
const SCHEDULE_IMPORT_NOTE_MARKER = "Source: user-provided import.";

function formatScheduleSource(
  source: MaintenanceSchedule["source"],
  notes?: string | null,
): string {
  if (
    source === "custom" &&
    notes &&
    notes.startsWith(SCHEDULE_IMPORT_NOTE_MARKER)
  ) {
    return "User provided";
  }
  switch (source) {
    case "user_provided":
      return "User provided";
    case "manual":
      return "Manual";
    case "web":
      return "Web";
    case "custom":
      return "Custom";
    default:
      return source;
  }
}

type ScheduleSourceFilter =
  | "all"
  | "user_provided"
  | "manual"
  | "web"
  | "custom";

function scheduleRowMatchesSourceFilter(
  row: MaintenanceSchedule,
  filter: ScheduleSourceFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "user_provided":
      return (
        row.source === "user_provided" ||
        (row.source === "custom" &&
          !!row.notes?.startsWith(SCHEDULE_IMPORT_NOTE_MARKER))
      );
    case "manual":
      return row.source === "manual";
    case "web":
      return row.source === "web";
    case "custom":
      return (
        row.source === "custom" &&
        !row.notes?.startsWith(SCHEDULE_IMPORT_NOTE_MARKER)
      );
    default:
      return true;
  }
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
          <Badge variant="outline" className="text-[10px]">
            {formatScheduleSource(row.source, row.notes)}
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
  const [scheduleSourceFilter, setScheduleSourceFilter] =
    useState<ScheduleSourceFilter>("user_provided");
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
  const [receiptParsing, setReceiptParsing] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  type ParsedScheduleDraft = {
    key: string;
    task: string;
    interval_miles: string;
    interval_months: string;
    notes: string;
    last_completed_at: string;
    last_mileage_at: string;
  };

  const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
  const [scheduleImportStep, setScheduleImportStep] = useState<
    "pick" | "review"
  >("pick");
  const [scheduleDrafts, setScheduleDrafts] = useState<ParsedScheduleDraft[]>(
    [],
  );
  const [scheduleParsing, setScheduleParsing] = useState(false);
  const [scheduleParseError, setScheduleParseError] = useState<string | null>(
    null,
  );
  const [scheduleBulkSaving, setScheduleBulkSaving] = useState(false);
  const scheduleCameraRef = useRef<HTMLInputElement>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

  const openManualLog = useCallback(
    (car: Car) => {
      setManualCarId(car.id);
      setManualTitle("");
      setManualDate(todayYmd());
      setManualMileage(String(car.mileage));
      setManualCost("");
      setManualNotes("");
      setReceiptError(null);
      setManualLogOpen(true);
    },
    [],
  );

  const parseReceiptFromFile = useCallback(
    async (file: File) => {
      if (!manualCarId) return;
      setReceiptError(null);
      setReceiptParsing(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error("Could not read file"));
          r.readAsDataURL(file);
        });
        const comma = dataUrl.indexOf(",");
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        const res = await fetch("/api/maintenance/parse-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType: file.type || "image/jpeg",
            carId: manualCarId,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          parsed?: {
            title: string;
            serviceDate: string | null;
            mileageAt: number | null;
            totalCost: number | null;
            notes: string | null;
          };
        };
        if (!res.ok) {
          throw new Error(json.error || "Parse failed");
        }
        if (!json.parsed) throw new Error("No data returned");
        const p = json.parsed;
        if (p.title?.trim()) setManualTitle(p.title.trim());
        if (p.serviceDate && isValidYmd(p.serviceDate)) setManualDate(p.serviceDate);
        if (p.mileageAt != null && Number.isFinite(p.mileageAt)) {
          setManualMileage(String(Math.round(p.mileageAt)));
        }
        if (p.totalCost != null && Number.isFinite(p.totalCost)) {
          setManualCost(String(p.totalCost));
        }
        if (p.notes?.trim()) setManualNotes(p.notes.trim());
      } catch (e) {
        setReceiptError(
          e instanceof Error ? e.message : "Could not read receipt",
        );
      } finally {
        setReceiptParsing(false);
      }
    },
    [manualCarId],
  );

  function onReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void parseReceiptFromFile(f);
  }

  function openScheduleImportModal() {
    setScheduleImportStep("pick");
    setScheduleDrafts([]);
    setScheduleParseError(null);
    setScheduleImportOpen(true);
  }

  async function parseScheduleFromFile(file: File) {
    if (!tab) return;
    setScheduleParseError(null);
    setScheduleParsing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const lower = file.name.toLowerCase();
      const isPdf =
        file.type === "application/pdf" || lower.endsWith(".pdf");
      const res = await fetch("/api/maintenance/parse-schedule-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isPdf
            ? { carId: tab, pdfBase64: base64 }
            : {
                carId: tab,
                imageBase64: base64,
                mediaType: file.type || "image/jpeg",
              },
        ),
      });
      const json = (await res.json()) as {
        error?: string;
        items?: Array<{
          task?: string;
          interval_miles?: number | null;
          interval_months?: number | null;
          notes?: string | null;
          lastCompletedDate?: string | null;
          lastMileageAt?: number | null;
        }>;
      };
      if (!res.ok) throw new Error(json.error || "Parse failed");
      const items = json.items ?? [];
      const drafts: ParsedScheduleDraft[] = items.map((it) => ({
        key: crypto.randomUUID(),
        task: (it.task ?? "").trim(),
        interval_miles:
          it.interval_miles != null && Number.isFinite(it.interval_miles)
            ? String(Math.round(it.interval_miles))
            : "",
        interval_months:
          it.interval_months != null && Number.isFinite(it.interval_months)
            ? String(Math.round(it.interval_months))
            : "",
        notes: (it.notes ?? "").trim(),
        last_completed_at:
          it.lastCompletedDate && isValidYmd(it.lastCompletedDate)
            ? it.lastCompletedDate
            : "",
        last_mileage_at:
          it.lastMileageAt != null && Number.isFinite(it.lastMileageAt)
            ? String(Math.round(it.lastMileageAt))
            : "",
      }));
      setScheduleDrafts(drafts);
      if (drafts.length === 0) {
        setScheduleParseError(
          "No tasks were extracted. Try a clearer photo or a different page.",
        );
        setScheduleImportStep("pick");
      } else {
        setScheduleImportStep("review");
      }
    } catch (e) {
      setScheduleParseError(
        e instanceof Error ? e.message : "Could not read schedule",
      );
    } finally {
      setScheduleParsing(false);
    }
  }

  function onScheduleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void parseScheduleFromFile(f);
  }

  function buildScheduleImportRows(
    drafts: ParsedScheduleDraft[],
    source: "user_provided" | "custom",
  ) {
    return drafts.map((d) => {
      const mi = d.interval_miles.trim()
        ? parseInt(d.interval_miles, 10)
        : NaN;
      const mo = d.interval_months.trim()
        ? parseInt(d.interval_months, 10)
        : NaN;
      const lastMi = d.last_mileage_at.trim()
        ? parseInt(d.last_mileage_at, 10)
        : NaN;
      const baseNotes = d.notes.trim() || null;
      const notes =
        source === "custom"
          ? baseNotes
            ? `${SCHEDULE_IMPORT_NOTE_MARKER} ${baseNotes}`
            : SCHEDULE_IMPORT_NOTE_MARKER
          : baseNotes;
      return {
        car_id: tab!,
        task: d.task.trim(),
        interval_miles: Number.isFinite(mi) ? mi : null,
        interval_months: Number.isFinite(mo) ? mo : null,
        notes,
        is_custom: true,
        source,
        last_completed_at:
          d.last_completed_at && isValidYmd(d.last_completed_at)
            ? localDateToNoonIso(d.last_completed_at)
            : null,
        last_mileage_at: Number.isFinite(lastMi) ? lastMi : null,
      };
    });
  }

  async function bulkAddParsedSchedules() {
    if (!tab) return;
    const toSave = scheduleDrafts.filter((d) => d.task.trim());
    if (toSave.length === 0) {
      alert("Add at least one task with a name, or cancel.");
      return;
    }
    setScheduleBulkSaving(true);
    const supabase = createClient();
    const rowsPreferred = buildScheduleImportRows(toSave, "user_provided");
    let { error } = await supabase
      .from("maintenance_schedules")
      .insert(rowsPreferred);

    const sourceCheckFailed =
      error &&
      (error.message?.includes("maintenance_schedules_source_check") ||
        error.message?.includes("source_check"));

    if (sourceCheckFailed) {
      const rowsFallback = buildScheduleImportRows(toSave, "custom");
      const second = await supabase
        .from("maintenance_schedules")
        .insert(rowsFallback);
      error = second.error;
    }

    setScheduleBulkSaving(false);
    if (error) {
      alert(
        `${error.message}\n\nIf this mentions a check constraint, run the SQL in supabase/migrations/20250409000100_maintenance_schedules_user_provided.sql on your database.`,
      );
      return;
    }
    setScheduleImportOpen(false);
    setScheduleImportStep("pick");
    setScheduleDrafts([]);
    await load();
  }

  async function clearAllScheduleRows() {
    if (!tab) return;
    const count = schedules[tab]?.length ?? 0;
    if (count === 0) return;
    if (
      !confirm(
        `Delete all ${count} maintenance task rows for this vehicle? This cannot be undone.`,
      )
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("maintenance_schedules")
      .delete()
      .eq("car_id", tab);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

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

  const suggestedNext = useMemo(() => {
    const act = cars.find((c) => c.id === tab) ?? cars[0];
    if (!act) {
      return {
        line: "Select a vehicle to see the next suggested task.",
        task: null,
        hasRankedNext: false,
      };
    }
    const scheduleRows = schedules[act.id] ?? [];
    const hist = logsByCar[act.id] ?? [];
    const logInputs = hist.map((h) => ({
      schedule_id: h.schedule_id,
      completed_at: h.completed_at,
      mileage_at: h.mileage_at,
      title: h.title,
    }));
    return computeSuggestedNextMaintenance(act, scheduleRows, logInputs);
  }, [cars, tab, schedules, logsByCar]);

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
        Add a vehicle in Garage to build a maintenance schedule.
      </p>
    );
  }

  const active = cars.find((c) => c.id === tab) ?? cars[0];
  const rows = schedules[active.id] ?? [];
  const filteredScheduleRows = rows.filter((r) =>
    scheduleRowMatchesSourceFilter(r, scheduleSourceFilter),
  );
  const historyRows = logsByCar[active.id] ?? [];

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Select value={tab} onValueChange={(val) => val && setTab(val)}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Select a car">
              {(() => {
                const c = cars.find((car) => car.id === tab);
                if (!c) return "Select a car";
                return `${c.year} ${c.make} ${c.model}`;
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {cars.map((c) => (
              <SelectItem 
                key={c.id} 
                value={c.id}
                label={`${c.year} ${c.make} ${c.model}`}
              >
                {c.year} {c.make} {c.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[220px]">
          <Label className="text-muted-foreground text-xs">Task source</Label>
          <Select
            value={scheduleSourceFilter}
            onValueChange={(val) =>
              val && setScheduleSourceFilter(val as ScheduleSourceFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user_provided" label="User provided">
                User provided
              </SelectItem>
              <SelectItem value="all" label="All sources">
                All sources
              </SelectItem>
              <SelectItem value="manual" label="Manual">
                Manual
              </SelectItem>
              <SelectItem value="web" label="Web">
                Web
              </SelectItem>
              <SelectItem value="custom" label="Custom">
                Custom
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
          <Button
            type="button"
            variant="outline"
            disabled={!tab || scheduleParsing}
            onClick={() => openScheduleImportModal()}
          >
            <ScanLine className="mr-2 size-4" />
            Import tasks (photo/PDF)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={rows.length === 0}
            onClick={() => void clearAllScheduleRows()}
          >
            <Trash2 className="mr-2 size-4" />
            Clear all rows
          </Button>
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
              ) : filteredScheduleRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center text-sm"
                  >
                    No tasks match this source filter. Choose another{" "}
                    <span className="text-foreground font-medium">
                      Task source
                    </span>{" "}
                    above to see other rows.
                  </TableCell>
                </TableRow>
              ) : (
                filteredScheduleRows.map((row) => (
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
          <div className="border-border/50 border-b px-4 py-3">
            <h3 className="text-sm font-semibold tracking-tight">
              Suggested next maintenance
            </h3>
            <div className="text-muted-foreground mt-0.5 max-w-2xl space-y-2 text-xs leading-relaxed">
              <p>
                <strong className="text-foreground font-medium">
                  Facts only — nothing is invented.
                </strong>{" "}
                This line is computed in the app from data you already entered: tasks
                and intervals in the schedule table above, the{" "}
                <strong className="text-foreground font-medium">
                  real odometer
                </strong>{" "}
                stored for this vehicle, and your{" "}
                <strong className="text-foreground font-medium">
                  service history
                </strong>{" "}
                (every row below, plus &quot;Last done&quot; on each schedule row).
                It does <strong className="text-foreground font-medium">not</strong>{" "}
                use AI here and cannot add maintenance you never listed.
              </p>
              <p>
                For date-based intervals with no prior service date in that history,
                the app counts months from{" "}
                <strong className="text-foreground font-medium">
                  January 1 of the vehicle model year
                </strong>{" "}
                only as a calendar anchor — it still does not assume any work was
                performed.
              </p>
            </div>
          </div>
          <div className="px-4 py-4">
            <p className="text-foreground text-sm font-medium leading-relaxed">
              {suggestedNext.line}
            </p>
            <p className="text-muted-foreground mt-2 border-border/40 border-t pt-2 text-[0.7rem] leading-relaxed">
              If this looks off, check that odometer, schedule intervals, and service
              history match reality — the suggestion only reflects what&apos;s in
              those fields.
            </p>
          </div>
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
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
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

      <Dialog
        open={manualLogOpen}
        onOpenChange={(open) => {
          setManualLogOpen(open);
          if (!open) setReceiptError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add manual service log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-muted/40 space-y-2 rounded-xl border border-border/50 p-3">
              <p className="text-sm font-medium tracking-tight">
                Scan a receipt or invoice
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Take a photo or upload an image of a service bill. Motiv will
                read it and fill the fields below — always review before saving.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={receiptParsing || !manualCarId}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 size-3.5" />
                  Take photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={receiptParsing || !manualCarId}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" />
                  Upload image
                </Button>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={onReceiptFileChange}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={onReceiptFileChange}
              />
              {receiptParsing ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading receipt…
                </div>
              ) : null}
              {receiptError ? (
                <p className="text-destructive text-xs">{receiptError}</p>
              ) : null}
            </div>

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
              disabled={
                manualSaving || receiptParsing || !manualTitle.trim()
              }
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

      <Dialog
        open={scheduleImportOpen}
        onOpenChange={(open) => {
          setScheduleImportOpen(open);
          if (!open) {
            setScheduleParseError(null);
            setScheduleImportStep("pick");
            setScheduleDrafts([]);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {scheduleImportStep === "pick"
                ? "Import maintenance tasks"
                : "Review imported tasks"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {scheduleImportStep === "pick" ? (
              <div className="bg-muted/40 space-y-2 rounded-xl border border-border/50 p-3">
                <p className="text-sm font-medium tracking-tight">
                  Scan or upload a maintenance schedule
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Take a photo or upload an image or PDF of a scheduled
                  maintenance list. Motiv will extract tasks — review and edit
                  before adding. Saved rows use source{" "}
                  <span className="text-foreground font-medium">
                    User provided
                  </span>
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={scheduleParsing || !tab}
                    onClick={() => scheduleCameraRef.current?.click()}
                  >
                    <Camera className="mr-1.5 size-3.5" />
                    Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={scheduleParsing || !tab}
                    onClick={() => scheduleFileRef.current?.click()}
                  >
                    <Upload className="mr-1.5 size-3.5" />
                    Upload image or PDF
                  </Button>
                </div>
                <input
                  ref={scheduleCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onScheduleFileInputChange}
                />
                <input
                  ref={scheduleFileRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onScheduleFileInputChange}
                />
                {scheduleParsing ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Loader2 className="size-3.5 animate-spin" />
                    Reading schedule…
                  </div>
                ) : null}
                {scheduleParseError ? (
                  <p className="text-destructive text-xs">{scheduleParseError}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Edit any field, remove rows you don&apos;t need, then add all to
                  this vehicle&apos;s schedule.
                </p>
                <div className="rounded-lg border border-border/50">
                  <div className="max-h-[min(420px,50vh)] overflow-x-auto overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[140px] whitespace-normal">
                            Task
                          </TableHead>
                          <TableHead className="w-[76px] px-1">Mi</TableHead>
                          <TableHead className="w-[76px] px-1">Mo</TableHead>
                          <TableHead className="w-[132px] px-1">
                            Last done
                          </TableHead>
                          <TableHead className="w-[84px] px-1">Last mi</TableHead>
                          <TableHead className="min-w-[120px] whitespace-normal">
                            Notes
                          </TableHead>
                          <TableHead className="w-10 p-1" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduleDrafts.map((d) => (
                          <TableRow key={d.key}>
                            <TableCell className="p-1 align-top">
                              <Input
                                value={d.task}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? { ...x, task: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input
                                value={d.interval_miles}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? {
                                            ...x,
                                            interval_miles: e.target.value,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                type="number"
                                className="h-8 w-full min-w-0 px-2 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input
                                value={d.interval_months}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? {
                                            ...x,
                                            interval_months: e.target.value,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                type="number"
                                className="h-8 w-full min-w-0 px-2 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input
                                type="date"
                                value={d.last_completed_at}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? {
                                            ...x,
                                            last_completed_at: e.target.value,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                className="h-8 w-full min-w-0 px-1 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input
                                value={d.last_mileage_at}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? {
                                            ...x,
                                            last_mileage_at: e.target.value,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                type="number"
                                className="h-8 w-full min-w-0 px-2 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Textarea
                                value={d.notes}
                                onChange={(e) =>
                                  setScheduleDrafts((prev) =>
                                    prev.map((x) =>
                                      x.key === d.key
                                        ? { ...x, notes: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                rows={2}
                                className="min-h-0 resize-y text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive size-8"
                                aria-label="Remove row"
                                onClick={() =>
                                  setScheduleDrafts((prev) =>
                                    prev.filter((x) => x.key !== d.key),
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 flex-shrink-0 flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:justify-end">
            {scheduleImportStep === "review" ? (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                onClick={() => {
                  setScheduleImportStep("pick");
                  setScheduleDrafts([]);
                  setScheduleParseError(null);
                }}
              >
                Scan another
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleImportOpen(false)}
            >
              Cancel
            </Button>
            {scheduleImportStep === "review" ? (
              <Button
                type="button"
                disabled={
                  scheduleBulkSaving ||
                  scheduleDrafts.filter((x) => x.task.trim()).length === 0
                }
                onClick={() => void bulkAddParsedSchedules()}
              >
                {scheduleBulkSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `Add all (${scheduleDrafts.filter((x) => x.task.trim()).length})`
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
