import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDateString, getTodayDateString } from "@/lib/today";
import {
  getMonthlyCompletedDatesByTask,
  getLifetimeCompletionCounts,
} from "@/lib/habit-stats-service";
import { monthlyCompletionStats, buildMonthlyCalendar } from "@/lib/habit-stats";
import { HabitStatsView } from "@/components/HabitStatsView";

export default async function HabitStatsPage() {
  const supabase = await createClient();
  const today = getTodayDateString();
  const [year, month] = today.split("-").map(Number);

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
  const monthStart = `${today.slice(0, 7)}-01`;

  const [monthlyDatesByHabit, lifetimeCounts] = await Promise.all([
    getMonthlyCompletedDatesByTask(player.id, taskIds, monthStart, today),
    getLifetimeCompletionCounts(player.id, taskIds),
  ]);

  const habitStats = (habits ?? []).map((habit) => {
    const activatedDate = getDateString(new Date(habit.activated_at));
    const monthlyDates = monthlyDatesByHabit.get(habit.id) ?? [];
    const monthly = monthlyCompletionStats(activatedDate, today, monthlyDates);
    const calendar = buildMonthlyCalendar(
      year,
      month,
      activatedDate,
      today,
      new Set(monthlyDates),
    );

    return {
      id: habit.id,
      title: habit.title,
      areaName: areaNameById.get(habit.area_id),
      currentStreak: habit.current_streak,
      longestStreak: habit.longest_streak,
      lifetimeCompleted: lifetimeCounts.get(habit.id) ?? 0,
      monthly,
      calendar,
    };
  });

  const aggregate = {
    avgRate:
      habitStats.length > 0
        ? habitStats.reduce((sum, h) => sum + h.monthly.rate, 0) / habitStats.length
        : 0,
    totalLifetime: habitStats.reduce((sum, h) => sum + h.lifetimeCompleted, 0),
  };

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Habit Stats</h1>
        <Link href="/" className="link-hover text-sm text-foreground/50">
          ← Today
        </Link>
      </div>
      <HabitStatsView habits={habitStats} aggregate={aggregate} />
    </main>
  );
}
