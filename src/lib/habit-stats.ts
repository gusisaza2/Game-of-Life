import { getDateString, daysBetween } from "@/lib/today";

// Habit Stats — derived entirely from existing data (task_logs' completed
// dates + a Task's activated_at), no new schema needed. Calendar month,
// not a rolling window (design discussion), and the denominator only
// counts days since the Habit was actually active this month, so a Habit
// that started mid-month isn't penalized for days before it existed.

export type MonthlyStats = {
  completed: number;
  daysActive: number;
  rate: number; // 0-1, 0 when daysActive is 0 (activated today or later)
};

export function monthlyCompletionStats(
  activatedDate: string,
  today: string,
  completedDatesThisMonth: string[],
): MonthlyStats {
  const monthStart = `${today.slice(0, 7)}-01`;
  const activeStart = activatedDate > monthStart ? activatedDate : monthStart;
  const daysActive = Math.max(0, daysBetween(activeStart, today) + 1);
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
