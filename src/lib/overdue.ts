import { shiftDate } from "@/lib/deadline";

// Helpers for re-dating many overdue tasks at once.

// The next Monday strictly after `today` ("YYYY-MM-DD").
export function nextMonday(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  const ahead = (8 - weekday) % 7 || 7;
  return shiftDate(today, ahead);
}

// New dates for `count` tasks, in the order given, spread evenly over `days`
// consecutive days starting at `startDate` (earlier tasks get earlier days).
export function spreadDates(count: number, startDate: string, days: number): string[] {
  if (count <= 0 || days <= 0) return [];
  return Array.from({ length: count }, (_, i) => shiftDate(startDate, Math.floor((i * days) / count)));
}
