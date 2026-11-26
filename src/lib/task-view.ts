import { compareByDeadline, deadlineStatus } from "@/lib/deadline";

// How the Missions and chores lists can be organized and filtered, on Today
// and on their own pages.

// More than this many open three-star tasks and the list says so, gently.
export const TOP_PRIORITY_SOFT_LIMIT = 5;

export type SortKey = "goal" | "priority" | "due" | "alpha";

export const SORT_LABELS: Record<SortKey, string> = {
  goal: "Goal",
  priority: "Priority",
  due: "Due date",
  alpha: "A–Z",
};

export type StarFilter = "all" | "3" | "2" | "1" | "0";

export const STAR_FILTER_LABELS: Record<StarFilter, string> = {
  all: "Any stars",
  "3": "★★★ only",
  "2": "★★ and up",
  "1": "★ and up",
  "0": "No stars",
};

export type WhenFilter = "open" | "all" | "overdue" | "today" | "soon" | "later" | "nodate" | "done";

export const WHEN_FILTER_LABELS: Record<WhenFilter, string> = {
  open: "All open",
  all: "Everything",
  overdue: "Overdue",
  today: "Due today",
  soon: "Due in 1–3 days",
  later: "Later",
  nodate: "No date",
  done: "Completed",
};

type Sortable = { title: string; due_date?: string | null; priority?: number };

const dated = (t: Sortable) => ({ title: t.title, due_date: t.due_date ?? null });

export function compareByDue(a: Sortable, b: Sortable): number {
  return compareByDeadline(dated(a), dated(b)) || (b.priority ?? 0) - (a.priority ?? 0);
}

// More stars first; between equals, the sooner deadline.
export function compareByPriority(a: Sortable, b: Sortable): number {
  return (b.priority ?? 0) - (a.priority ?? 0) || compareByDeadline(dated(a), dated(b));
}

export function compareByTitle(a: Sortable, b: Sortable): number {
  return a.title.localeCompare(b.title);
}

export function matchesStars(priority: number, filter: StarFilter): boolean {
  if (filter === "all") return true;
  if (filter === "0") return priority === 0;
  return priority >= Number(filter);
}

export function matchesWhen(
  task: { due_date?: string | null },
  done: boolean,
  filter: WhenFilter,
  today: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "done") return done;
  // Every other filter is about open work -- but what was finished today
  // stays visible under "All open" (it sits in the Completed folder).
  if (filter === "open") return true;
  if (done) return false;
  if (!task.due_date) return filter === "nodate";
  const { kind } = deadlineStatus(task.due_date, today);
  if (filter === "overdue") return kind === "overdue";
  if (filter === "today") return kind === "today";
  if (filter === "soon") return kind === "tomorrow" || kind === "soon";
  if (filter === "later") return kind === "later";
  return false;
}

export function dueBucket(dueDate: string | null | undefined, today: string): { order: number; label: string } {
  if (!dueDate) return { order: 4, label: "No date" };
  const { kind } = deadlineStatus(dueDate, today);
  if (kind === "overdue") return { order: 0, label: "Overdue" };
  if (kind === "today") return { order: 1, label: "Due today" };
  if (kind === "tomorrow" || kind === "soon") return { order: 2, label: "Next 3 days" };
  return { order: 3, label: "Later" };
}
