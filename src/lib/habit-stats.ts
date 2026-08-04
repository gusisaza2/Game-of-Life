import { getDateString, daysBetween } from "@/lib/today";

// Habit Stats — derived entirely from existing data (task_logs' completed
// dates + a Task's activated_at), no new schema needed. Calendar month,
// not a rolling window (design discussion). The denominator is the full
// size of this month's window for the Habit -- every day from month start
// (or activation date, if it started mid-month) through the *last* day of
// the month, not just the days elapsed so far. So "0/30" on day 1 counts
// down/up toward the whole month, instead of reading as "0/1" and growing
// by one each day -- a Habit that started mid-month still isn't penalized
// for days before it existed, it just gets a smaller (but still fixed)
// window instead of a shrinking one.

export type MonthlyStats = {
  completed: number;
  daysActive: number;
  rate: number; // 0-1, 0 when daysActive is 0
};

export function monthlyCompletionStats(
  activatedDate: string,
  today: string,
  completedDatesThisMonth: string[],
): MonthlyStats {
  const monthStart = `${today.slice(0, 7)}-01`;
  const activeStart = activatedDate > monthStart ? activatedDate : monthStart;
  const [year, month] = today.split("-").map(Number);
  const monthEnd = getDateString(new Date(year, month, 0)); // day 0 of next month = last day of this month
  const daysActive = Math.max(0, daysBetween(activeStart, monthEnd) + 1);
  const completed = completedDatesThisMonth.filter(
    (d) => d >= activeStart && d <= today,
  ).length;

  return { completed, daysActive, rate: daysActive > 0 ? completed / daysActive : 0 };
}

export type DayStatus = "completed" | "missed" | "inactive" | "future";

export type CalendarDay = {
  date: string;
  day: number;
  status: DayStatus;
};

export type MonthlyCalendar = {
  monthLabel: string;
  leadingBlanks: number; // days-of-week before day 1, for grid alignment
  days: CalendarDay[];
};

export function buildMonthlyCalendar(
  year: number,
  month: number, // 1-12
  activatedDate: string,
  today: string,
  completedDates: Set<string>,
): MonthlyCalendar {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = getDateString(new Date(year, month - 1, d));
    let status: DayStatus;
    if (date > today) status = "future";
    else if (date < activatedDate) status = "inactive";
    else if (completedDates.has(date)) status = "completed";
    else status = "missed";
    days.push({ date, day: d, status });
  }

  return {
    monthLabel: firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    leadingBlanks: firstOfMonth.getDay(),
    days,
  };
}
