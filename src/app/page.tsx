import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDateString, getTodayDateString } from "@/lib/today";
import { getYesterdayGoodDay } from "@/lib/good-day-service";
import { refreshAllAreaCapacities } from "@/lib/capacity-service";
import { getLevelProgress } from "@/lib/level-progress";
import { milestoneNameForLevel } from "@/lib/milestones";
import { TaskSection } from "@/components/TaskSection";
import { LevelProgress } from "@/components/LevelProgress";

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
  const {
    goodDay: yesterdayGoodDay,
    nivelUp,
    player: freshPlayerState,
  } = await getYesterdayGoodDay(player.id, today, earliestDate);
  // The backfill above may have just changed the Chapter, XP gate progress,
  // or Nivel — use its returned state rather than the `player` fetched
  // above, which is now stale.
  const currentLevel = freshPlayerState?.current_level ?? player.current_level;
  const cumulativeXp = freshPlayerState?.cumulative_xp ?? Number(player.cumulative_xp);
  const lifetimeGoodDayCount =
    freshPlayerState?.lifetime_good_day_count ?? player.lifetime_good_day_count;

  // Decay has no cron yet — recompute on-read (CLAUDE.md build order).
  await refreshAllAreaCapacities(player.id, currentLevel, today, earliestDate);

  const [{ data: tasks }, { data: logs }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, tier")
      .eq("player_id", player.id)
      .eq("is_active", true)
      .order("title"),
    supabase
      .from("task_logs")
      .select("task_id")
      .eq("player_id", player.id)
      .eq("completed_date", today),
  ]);

  const completedIds = new Set((logs ?? []).map((log) => log.task_id));
  const habits = (tasks ?? []).filter((t) => t.tier === "habit");
  const mainTasks = (tasks ?? []).filter((t) => t.tier === "main_task");
  const chores = (tasks ?? []).filter((t) => t.tier === "chore");

  const levelLabel = currentLevel === 0 ? "Tutorial" : `Chapter ${currentLevel}`;
  const milestoneName = milestoneNameForLevel(currentLevel);
  const progress = getLevelProgress(currentLevel, cumulativeXp, lifetimeGoodDayCount);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 p-8 sm:p-16">
      <header className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <Link href="/manage" className="text-sm text-foreground/60 hover:text-foreground">
          Manage →
        </Link>
      </header>

      {nivelUp && (
        <div className="w-full max-w-md rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-3 text-center text-sm font-medium">
          Nivel up! {nivelUp.nivelReached} / {nivelUp.totalNiveles}
        </div>
      )}

      <LevelProgress
        levelLabel={levelLabel}
        milestoneName={milestoneName}
        xp={progress.xp}
        goodDays={progress.goodDays}
      />

      {yesterdayGoodDay && (
        <p className="w-full max-w-md text-sm text-foreground/60">
          Yesterday:{" "}
          <span className="font-medium text-foreground">
            {yesterdayGoodDay.isGoodDay ? "Good Day ✓" : "Not a Good Day"}
          </span>
        </p>
      )}

      <TaskSection
        title="Habits"
        tasks={habits}
        completedIds={completedIds}
        playerId={player.id}
        today={today}
      />
      <TaskSection
        title="Main Tasks"
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
    </main>
  );
}
