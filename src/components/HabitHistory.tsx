import { SectionHeading } from "./SectionHeading";
import { areaColor } from "@/lib/area-colors";
import { monthKeysDescending, monthLabelFor, statsForMonth } from "@/lib/habit-stats";

export type HistoryHabit = {
  id: string;
  title: string;
  areaName: string | undefined;
  activatedDate: string;
  completedDates: string[];
};

// One card per month, newest first, listing how many days each Habit was
// done out of that month's window -- the same "X/Y" the rest of Habit
// Stats uses (fixed month-size denominator, see habit-stats.ts), so a
// number here always matches what the habit's own month view shows.
export function HabitHistory({ habits, today }: { habits: HistoryHabit[]; today: string }) {
  if (habits.length === 0) return null;

  const earliestKey = habits
    .map((h) => h.activatedDate.slice(0, 7))
    .reduce((a, b) => (a < b ? a : b));
  const monthKeys = monthKeysDescending(earliestKey, today.slice(0, 7));

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
        History by month
      </SectionHeading>

      {monthKeys.map((monthKey) => {
        const rows = habits
          .map((habit) => ({
            habit,
            stats: statsForMonth(habit.activatedDate, today, monthKey, habit.completedDates),
          }))
          .filter((row) => row.stats.daysActive > 0);
        if (rows.length === 0) return null;

        return (
          <div
            key={monthKey}
            className="flex flex-col gap-2 rounded-xl border border-foreground/20 bg-surface p-4"
          >
            <p className="text-sm font-semibold">{monthLabelFor(monthKey)}</p>
            <ul className="flex flex-col gap-1.5">
              {rows.map(({ habit, stats }) => (
                <li key={habit.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: areaColor(habit.areaName).accent }}
                    />
                    <span className="min-w-0">{habit.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground/60">
                    {stats.completed}/{stats.daysActive}
                    <span className="text-foreground/40"> · {Math.round(stats.rate * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
