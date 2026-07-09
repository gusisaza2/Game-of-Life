import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDateString, getTodayDateString } from "@/lib/today";
import { getYesterdayGoodDay } from "@/lib/good-day-service";
import { refreshAllAreaCapacities } from "@/lib/capacity-service";
import { getLevelProgress } from "@/lib/level-progress";
import { getNivelProgress } from "@/lib/nivel";
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
      .select("task_id, xp_awarded")
      .eq("player_id", player.id)
      .eq("completed_date", today),
  ]);

  const completedIds = new Set((logs ?? []).map((log) => log.task_id));
  // Live "XP today" — every completed task's contribution, Growth or Bonus
  // alike (design doc Section 2.1: immediate feedback, not the same thing
  // as cumulative_xp, which only counts Growth XP toward Nivel).
  const xpToday = (logs ?? []).reduce((sum, log) => sum + Number(log.xp_awarded), 0);
  const habits = (tasks ?? []).filter((t) => t.tier === "habit");
  const mainTasks = (tasks ?? []).filter((t) => t.tier === "main_task");
  const chores = (tasks ?? []).filter((t) => t.tier === "chore");

  const levelLabel = `Chapter ${currentLevel}`;
  const milestoneName = milestoneNameForLevel(currentLevel);
  const progress = getLevelProgress(currentLevel, lifetimeGoodDayCount);
  const nivelProgress = getNivelProgress(currentLevel, cumulativeXp);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 p-8 sm:p-16">
      <div className="w-full max-w-md flex flex-col gap-1">
        <header className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Today</h1>
          <Link href="/manage" className="text-sm text-foreground/60 hover:text-foreground">
            Manage →
          </Link>
        </header>
        <p className="text-sm text-foreground/60">
          XP today: <span className="font-medium text-foreground">{xpToday}</span>
        </p>
      </div>

      <LevelProgress
        levelLabel={levelLabel}
        milestoneName={milestoneName}
        goodDays={progress.goodDays}
        nivel={nivelProgress}
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
