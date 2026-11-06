import { daysBetween } from "@/lib/today";

// Deadlines for one-off tasks (Main Tasks and Chores). Habits recur, so a
// deadline doesn't mean anything for them.

// A dated task surfaces on Today this many days before its deadline (and
// stays there, flagged overdue, until it's done). Before that it lives in
// the Backlog.
export const DEADLINE_WINDOW_DAYS = 3;

export function needsDeadline(tier: string): boolean {
  return tier !== "habit";
}

// "YYYY-MM-DD" and a real calendar day -- Date.parse alone accepts
// "2026-02-30" and rolls it into March, so round-trip the parts instead.
export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export type DeadlineKind = "overdue" | "today" | "tomorrow" | "soon" | "later";

export function deadlineStatus(dueDate: string, today: string): { kind: DeadlineKind; days: number } {
  const days = daysBetween(today, dueDate);
  if (days < 0) return { kind: "overdue", days };
  if (days === 0) return { kind: "today", days };
  if (days === 1) return { kind: "tomorrow", days };
  if (days <= DEADLINE_WINDOW_DAYS) return { kind: "soon", days };
  return { kind: "later", days };
}

export function deadlineLabel(dueDate: string, today: string): string {
  const { kind, days } = deadlineStatus(dueDate, today);
  switch (kind) {
    case "overdue":
      return days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`;
    case "today":
      return "Due today";
    case "tomorrow":
      return "Due tomorrow";
    default:
      return `Due in ${days} days`;
  }
}

type DatedTask = { tier: string; due_date: string | null; done_date: string | null };

// Where a task belongs on Today:
//   shown    -- on the list (habits, undated legacy tasks, dated tasks inside
//               their window or overdue, and anything finished today so its
//               checkbox still reads as done)
//   backlog  -- dated, not due soon: kept out of the way, listed by date
//   hidden   -- already finished on an earlier day; done for good
export function todayPlacement(task: DatedTask, today: string): "shown" | "backlog" | "hidden" {
  if (!needsDeadline(task.tier)) return "shown";
  if (task.done_date !== null) return task.done_date < today ? "hidden" : "shown";
  if (task.due_date === null) return "shown";
  return daysBetween(today, task.due_date) <= DEADLINE_WINDOW_DAYS ? "shown" : "backlog";
}

// Soonest deadline first (overdue ones naturally lead); undated tasks last.
export function compareByDeadline(
  a: { due_date: string | null; title: string },
  b: { due_date: string | null; title: string },
): number {
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

// Whether a dated task counted as "due" on a given past day, for the Good
// Day tally. Mirrors todayPlacement: it must exist by then, be inside its
// window (or overdue), and not already be finished on an earlier day.
export function isDueOnDay(
  dueDate: string,
  doneDate: string | null,
  createdDate: string,
  day: string,
): boolean {
  if (createdDate > day) return false;
  if (doneDate !== null && doneDate < day) return false;
  return daysBetween(day, dueDate) <= DEADLINE_WINDOW_DAYS;
}

// Calendar-day arithmetic on a "YYYY-MM-DD" string, with no timezone in play.
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
