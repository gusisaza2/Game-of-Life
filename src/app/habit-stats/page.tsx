import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDateString, getTodayDateString } from "@/lib/today";
import { getAllCompletedDatesByTask } from "@/lib/habit-stats-service";
import { statsForMonth } from "@/lib/habit-stats";
import { HabitStatsView } from "@/components/HabitStatsView";

export default async function HabitStatsPage() {
  const supabase = await createClient();
  const today = getTodayDateString();
  const currentMonthKey = today.slice(0, 7);

  const { data: player } = await supabase.from("players").select("id").single();
  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  const [{ data: habits }, { data: areas }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, area_id, current_streak, longest_streak, activated_at")
      .eq("player_id", player.id)
      .eq("tier", "habit")
      .order("title"),
    supabase.from("areas").select("id, name"),
  ]);

  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name as string]));
  const taskIds = (habits ?? []).map((h) => h.id);
  const datesByHabit = await getAllCompletedDatesByTask(player.id, taskIds);

  const habitStats = (habits ?? []).map((habit) => {
    const completedDates = datesByHabit.get(habit.id) ?? [];
    // The data wins over the activation timestamp: a completion logged
    // before a habit's recorded activation date (e.g. after a day-boundary
    // correction nudged it back a day) must still count and show up, not
    // be dropped as "before the habit existed".
    const activated = getDateString(new Date(habit.activated_at));
    const activatedDate =
      completedDates.length > 0 && completedDates[0] < activated ? completedDates[0] : activated;

    return {
      id: habit.id,
      title: habit.title,
      areaName: areaNameById.get(habit.area_id),
      currentStreak: habit.current_streak,
      longestStreak: habit.longest_streak,
      activatedDate,
      completedDates,
      monthly: statsForMonth(activatedDate, today, currentMonthKey, completedDates),
    };
  });

  const aggregate = {
    avgRate:
      habitStats.length > 0
        ? habitStats.reduce((sum, h) => sum + h.monthly.rate, 0) / habitStats.length
        : 0,
    totalLifetime: habitStats.reduce((sum, h) => sum + h.completedDates.length, 0),
  };

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Habit Stats</h1>
        <Link href="/" className="link-hover text-sm text-foreground/50">
          ← Today
        </Link>
      </div>
      <HabitStatsView habits={habitStats} aggregate={aggregate} today={today} />
    </main>
  );
}
