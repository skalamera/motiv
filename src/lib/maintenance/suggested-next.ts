import type { Car, MaintenanceSchedule } from "@/types/database";

/**
 * Deterministic “next maintenance” picker. Does not call AI and does not invent
 * tasks or intervals: it only ranks rows already in `schedules`, using
 * `car.mileage`, interval fields on those rows, and last-done data merged from
 * schedule columns plus `logs` (linked by `schedule_id` or matching `title`).
 * Time-based math with no prior service date uses Jan 1 of `car.year` only as a
 * calendar anchor—not guessed work history.
 */

/** Minimal log fields to align service history with schedule rows. */
export type MaintenanceLogForSuggestion = {
  schedule_id: string | null;
  completed_at: string;
  mileage_at: number | null;
  title: string | null;
};

export type SuggestedNextMaintenanceResult = {
  line: string;
  task: string | null;
  /** True when a concrete next task was ranked from interval-backed schedule rows (not placeholders). */
  hasRankedNext: boolean;
};

function normTask(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDate(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  if (x.getDate() < day) x.setDate(0);
  return x;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function vehicleTimeAnchor(car: Car): Date {
  return new Date(car.year, 0, 1);
}

function logsForSchedule(
  schedule: MaintenanceSchedule,
  logs: MaintenanceLogForSuggestion[],
): MaintenanceLogForSuggestion[] {
  const taskNorm = normTask(schedule.task);
  return logs.filter((log) => {
    if (log.schedule_id === schedule.id) return true;
    if (log.schedule_id != null) return false;
    const t = log.title?.trim();
    if (!t) return false;
    return normTask(t) === taskNorm;
  });
}

function mergeLastService(
  schedule: MaintenanceSchedule,
  linked: MaintenanceLogForSuggestion[],
): { lastMi: number | null; lastAt: Date | null } {
  let lastMi =
    schedule.last_mileage_at != null && Number.isFinite(schedule.last_mileage_at)
      ? schedule.last_mileage_at
      : null;
  let lastAt: Date | null = schedule.last_completed_at
    ? parseDate(schedule.last_completed_at)
    : null;

  for (const log of linked) {
    if (log.mileage_at != null && Number.isFinite(log.mileage_at)) {
      if (lastMi == null || log.mileage_at > lastMi) lastMi = log.mileage_at;
    }
    const at = parseDate(log.completed_at);
    if (at.getTime() > 0) {
      if (!lastAt || at > lastAt) lastAt = at;
    }
  }

  return { lastMi, lastAt };
}

type MileOutlook = {
  remaining: number | null;
  overdue: number | null;
};

function mileOutlook(
  lastMi: number | null,
  interval: number,
  currentMi: number,
): MileOutlook {
  let due = (lastMi ?? 0) + interval;
  if (lastMi == null) due = interval;
  let steps = 0;
  while (due < currentMi) {
    due += interval;
    steps++;
  }
  const remaining = due - currentMi;
  const overdue =
    steps > 0 ? currentMi - (due - interval) : null;
  return { remaining, overdue };
}

type TimeOutlook = {
  remainingDays: number | null;
  overdueDays: number | null;
  nextDue: Date | null;
};

function timeOutlook(
  lastAt: Date | null,
  intervalMonths: number,
  anchor: Date,
  now: Date,
): TimeOutlook {
  const ref = lastAt ?? anchor;
  let due = addMonths(ref, intervalMonths);
  let steps = 0;
  while (startOfDay(due) < startOfDay(now)) {
    due = addMonths(due, intervalMonths);
    steps++;
  }
  const remainingDays = daysBetween(now, due);
  const overdueDays =
    steps > 0
      ? Math.max(0, daysBetween(addMonths(due, -intervalMonths), now))
      : null;
  return { remainingDays, overdueDays, nextDue: due };
}

type TaskUrgency = {
  schedule: MaintenanceSchedule;
  score: number;
  mile: MileOutlook | null;
  time: TimeOutlook | null;
};

function buildTaskUrgency(
  car: Car,
  schedule: MaintenanceSchedule,
  logs: MaintenanceLogForSuggestion[],
  now: Date,
): TaskUrgency | null {
  const linked = logsForSchedule(schedule, logs);
  const { lastMi, lastAt } = mergeLastService(schedule, linked);
  const ivM = schedule.interval_miles;
  const ivT = schedule.interval_months;

  if (
    (ivM == null || ivM <= 0) &&
    (ivT == null || ivT <= 0)
  ) {
    return null;
  }

  const mile =
    ivM != null && ivM > 0
      ? mileOutlook(lastMi, ivM, car.mileage)
      : null;
  const time =
    ivT != null && ivT > 0
      ? timeOutlook(lastAt, ivT, vehicleTimeAnchor(car), now)
      : null;

  const mileOver = mile?.overdue != null && mile.overdue > 0;
  const timeOver = time?.overdueDays != null && time.overdueDays > 0;
  const mileSoon =
    !mileOver &&
    mile &&
    mile.remaining != null &&
    mile.remaining <= 750;
  const timeSoon =
    !timeOver &&
    time &&
    time.remainingDays != null &&
    time.remainingDays <= 30;

  let score = 500_000;
  if (mileOver || timeOver) {
    const mo = mileOver ? Math.min(mile!.overdue!, 200_000) : 0;
    const to = timeOver ? Math.min(time!.overdueDays!, 10_000) : 0;
    score = -2_000_000 - mo * 50 - to;
  } else if (mileSoon || timeSoon) {
    const mr = mileSoon ? (mile!.remaining ?? 99999) : 100_000;
    const dr = timeSoon ? (time!.remainingDays ?? 9999) : 10_000;
    score = -500_000 + mr + dr * 25;
  } else {
    const mr = mile?.remaining ?? 200_000;
    const dr = time?.remainingDays ?? 5000;
    score = mr + dr * 40;
  }

  return { schedule, score, mile, time };
}

function formatLine(u: TaskUrgency): string {
  const { schedule: s } = u;
  const bits: string[] = [];

  if (u.mile) {
    if (u.mile.overdue != null && u.mile.overdue > 0) {
      bits.push(`~${u.mile.overdue.toLocaleString()} mi past interval`);
    } else if (u.mile.remaining != null) {
      if (u.mile.remaining === 0) {
        bits.push("due now by mileage");
      } else {
        bits.push(`~${u.mile.remaining.toLocaleString()} mi to go`);
      }
    }
  }

  if (u.time?.nextDue) {
    if (u.time.overdueDays != null && u.time.overdueDays > 0) {
      bits.push(
        u.time.overdueDays === 1
          ? "1 day past date interval"
          : `${u.time.overdueDays} days past date interval`,
      );
    } else if (u.time.remainingDays != null) {
      if (u.time.remainingDays === 0) {
        bits.push("due today by date");
      } else {
        const ds = u.time.nextDue.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        bits.push(`by ${ds}`);
      }
    }
  }

  const tail = bits.length ? ` — ${bits.join(" · ")}` : "";
  return `${s.task}${tail}`;
}

/**
 * Picks among existing `schedules` only. Uses `car.mileage`, each row’s interval
 * fields, and merged last-service data from row + `logs`. No generative AI; no
 * tasks or intervals invented outside the provided data.
 */
export function computeSuggestedNextMaintenance(
  car: Car,
  schedules: MaintenanceSchedule[],
  logs: MaintenanceLogForSuggestion[],
  now = new Date(),
): SuggestedNextMaintenanceResult {
  if (schedules.length === 0) {
    return {
      line: "No schedule yet — generate or add tasks above.",
      task: null,
      hasRankedNext: false,
    };
  }

  const candidates: TaskUrgency[] = [];
  for (const row of schedules) {
    const u = buildTaskUrgency(car, row, logs, now);
    if (u) candidates.push(u);
  }

  if (candidates.length === 0) {
    return {
      line: `${schedules[0]!.task} — add mileage or month intervals to compare against your odometer and vehicle age.`,
      task: schedules[0]!.task,
      hasRankedNext: false,
    };
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0]!;
  return {
    line: formatLine(best),
    task: best.schedule.task,
    hasRankedNext: true,
  };
}
