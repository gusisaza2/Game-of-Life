import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDateString, getTodayDateString } from "@/lib/today";
import { getYesterdayGoodDay } from "@/lib/good-day-service";
import { refreshAllAreaCapacities } from "@/lib/capacity-service";
import { getLevelProgress } from "@/lib/level-progress";
import { getNivelProgress } from "@/lib/nivel";
import { milestoneNameForLevel } from "@/lib/milestones";
import { activateScheduledTasks } from "@/lib/scheduled-activation-service";
import { refreshHabitStreaks } from "@/lib/habit-streak-service";
import { getMonthlyCompletedDatesByTask } from "@/lib/habit-stats-service";
import { monthlyCompletionStats } from "@/lib/habit-stats";
import { perAreaDailyXpCeiling } from "@/lib/leveling";
import { TaskSection } from "@/components/TaskSection";
import { LevelProgress } from "@/components/LevelProgress";
import { Badge } from "@/components/Badge";
import { HabitStreakCard } from "@/components/HabitStreakCard";
import { SectionHeading } from "@/components/SectionHeading";
import { AvatarWidget } from "@/components/AvatarWidget";
import { AREA_COLORS, areaColor } from "@/lib/area-colors";
// Ship is deliberately not rendered on Today right now — its visual design
// is a separate, later pass (see CLAUDE.md). The component itself is
// untouched; this screen just doesn't mount it tonight.

export default async function TodayPage() {
  const supabase = await createClient();
  const today = getTodayDateString();

  const { data: player } = await supabase.from("players").select("*").single();

  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  const earliestDate = getDateString(new Date(player.created_at));
  const { goodDay: yesterdayGoodDay, player: freshPlayerState } = await getYesterdayGoodDay(
    player.id,
    today,
    earliestDate,
  );
  // The backfill above may have just changed the Chapter or Good Day
  // progress — use its returned state rather than the `player` fetched
  // above, which is now stale.
  const currentLevel = freshPlayerState?.current_level ?? player.current_level;
  const cumulativeXp = freshPlayerState?.cumulative_xp ?? Number(player.cumulative_xp);
  const lifetimeGoodDayCount =
    freshPlayerState?.lifetime_good_day_count ?? player.lifetime_good_day_count;

  // Decay has no cron yet — recompute on-read (CLAUDE.md build order).
  // Same on-read pattern for tasks scheduled to "activate tomorrow" (flips
  // them on once that date has arrived) and for Habit Streaks (a missed day
  // breaks one with no grace period, checked here so it shows as broken the
  // moment the page loads). None of the three touch each other's data, so
  // they run together instead of one after another.
  await Promise.all([
    refreshAllAreaCapacities(player.id, currentLevel, today, earliestDate),
    activateScheduledTasks(player.id, today),
    refreshHabitStreaks(player.id, today),
  ]);

  const [{ data: tasks }, { data: logs }, { data: areas }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, tier, area_id, current_streak, longest_streak, activated_at")
      .eq("player_id", player.id)
      .eq("is_active", true)
      .order("title"),
    supabase
      .from("task_logs")
      .select("task_id, xp_awarded")
      .eq("player_id", player.id)
      .eq("completed_date", today),
    supabase.from("areas").select("id, name, is_foundation"),
  ]);

  const areasById = new Map((areas ?? []).map((a) => [a.id, a]));
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name as string]));
  const tasksWithArea = (tasks ?? []).map((t) => ({
    ...t,
    areaName: areaNameById.get(t.area_id),
  }));

  const completedIds = new Set((logs ?? []).map((log) => log.task_id));
  // Live "XP today" — every completed task's contribution, Growth or Bonus
  // alike (design doc Section 2.1: immediate feedback, not the same thing
  // as cumulative_xp, which only counts Growth XP toward Nivel).
  const xpToday = (logs ?? []).reduce((sum, log) => sum + Number(log.xp_awarded), 0);

  // Avatar Growth Rings (design doc Section 20): each ring = today's XP
  // earned in that Area (any tier, same "todaysXP" the live XP counter
  // above already sums) divided by that Area's per-area daily ceiling.
  // Resets naturally every day since it's derived from today's logs only,
  // no stored state of its own.
  const taskAreaNameById = new Map(tasksWithArea.map((t) => [t.id, t.areaName]));
  const xpTodayByArea = new Map<string, number>();
  for (const log of logs ?? []) {
    const areaName = taskAreaNameById.get(log.task_id);
    if (!areaName) continue;
    xpTodayByArea.set(areaName, (xpTodayByArea.get(areaName) ?? 0) + Number(log.xp_awarded));
  }
  const growthRings = Object.keys(AREA_COLORS).map((areaName) => {
    const area = (areas ?? []).find((a) => a.name === areaName);
    const ceiling = perAreaDailyXpCeiling(currentLevel, area?.is_foundation ?? false);
    const earned = xpTodayByArea.get(areaName) ?? 0;
    return { areaName, fill: ceiling > 0 ? earned / ceiling : 0, color: areaColor(areaName).accent };
  });

  const avatarConfig = {
    gender: player.avatar_gender as "male" | "female",
    skinTone: player.avatar_skin_tone as string,
    hairStyle: player.avatar_hair_style as "short" | "long" | "bald",
    hairColor: player.avatar_hair_color as string,
    eyeColor: player.avatar_eye_color as string,
  };

  const habits = tasksWithArea.filter((t) => t.tier === "habit");
  const mainTasks = tasksWithArea.filter((t) => t.tier === "main_task");
  const chores = tasksWithArea.filter((t) => t.tier === "chore");

  // Habit Stats — this month's completion rate, shown right on the card so
  // it stays visible even when "days in a row" is 0 (design discussion:
  // the streak resetting shouldn't feel like starting from nothing).
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthlyDatesByHabit = await getMonthlyCompletedDatesByTask(
    player.id,
    habits.map((h) => h.id),
    monthStart,
    today,
  );

  const levelLabel = `Chapter ${currentLevel}`;
  const milestoneName = milestoneNameForLevel(currentLevel);
  const progress = getLevelProgress(currentLevel, lifetimeGoodDayCount);
  const nivelProgress = getNivelProgress(currentLevel, cumulativeXp);

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <div className="flex items-center gap-3">
            <Link href="/manage" className="link-hover text-sm text-foreground/50">
              Manage →
            </Link>
            <AvatarWidget playerId={player.id} config={avatarConfig} rings={growthRings} />
          </div>
        </header>

        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/20 bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/45">
              XP today
            </span>
            <span
              key={xpToday}
              className="text-2xl font-semibold tabular-nums xp-today-pop"
            >
              {formatXp(xpToday)}
            </span>
          </div>

          <div className="h-px bg-foreground/10" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {levelLabel}
              {milestoneName && <span className="text-foreground/50"> · {milestoneName}</span>}
            </p>
            {yesterdayGoodDay && (
              <p className="flex items-center gap-1.5 text-xs text-foreground/45">
                Yesterday:
                <Badge tone={yesterdayGoodDay.isGoodDay ? "balance" : "muted"}>
                  {yesterdayGoodDay.isGoodDay ? "Good Day" : "Not a Good Day"}
                </Badge>
              </p>
            )}
          </div>

          <LevelProgress goodDays={progress.goodDays} nivel={nivelProgress} />
        </div>
      </div>

      {habits.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Habit Streaks
            </SectionHeading>
            <Link href="/habit-stats" className="link-hover text-xs text-foreground/45">
              Habit Stats →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {habits.map((habit) => {
              const area = areasById.get(habit.area_id);
              const ceiling = perAreaDailyXpCeiling(currentLevel, area?.is_foundation ?? false);
              const activatedDate = getDateString(new Date(habit.activated_at));
              const monthly = monthlyCompletionStats(
                activatedDate,
                today,
                monthlyDatesByHabit.get(habit.id) ?? [],
              );
              return (
                <HabitStreakCard
                  key={habit.id}
                  taskId={habit.id}
                  title={habit.title}
                  areaName={habit.areaName}
                  currentStreak={habit.current_streak}
                  longestStreak={habit.longest_streak}
                  areaDailyCeiling={ceiling}
                  completed={completedIds.has(habit.id)}
                  playerId={player.id}
                  today={today}
                  monthlyCompleted={monthly.completed}
                  monthlyDaysActive={monthly.daysActive}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-6">
        <TaskSection
          title="Misiones"
          tasks={mainTasks}
          completedIds={completedIds}
          playerId={player.id}
          today={today}
        />
        <TaskSection
          title="Chores"
          tasks={chores}
          completedIds={completedIds}
          playerId={player.id}
          today={today}
        />
      </div>
    </main>
  );
}

function formatXp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
