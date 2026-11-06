import { createClient } from "@/lib/supabase/server";
import { perAreaDailyXpCeiling, TIER_XP_MULTIPLIER } from "@/lib/leveling";
import { getDateString } from "@/lib/today";

type Tier = keyof typeof TIER_XP_MULTIPLIER;
export type XpType = "growth" | "bonus";

export type XpResult = {
  xpAwarded: number;
  xpType: XpType;
};

// XP for a single task completion.
//
// Growth XP (feeds cumulative_xp / the Chapter-up gate) is capped at that
// area's remaining daily ceiling. Overflow is explicitly out of scope for
// MVP (CLAUDE.md: "can hardcode 'no overflow yet' — just cap XP at the
// daily ceiling for now").
//
// Task Activation Delay (CLAUDE.md #9 / design doc 6.5): a task activated
// today, completed today, that isn't exempt (Path template / system
// content) earns Bonus XP instead — full tier value, but uncapped by the
// area ceiling and excluded from cumulative_xp, since it doesn't feed
// Growth-phase leveling. "Activated" (not "created") because a backlog
// Task planned for a Milestone can sit inactive for weeks before the
// player turns it on — the delay should key off that moment, not the
// original creation date.
// Takes the player's level, the task's own fields, and its area's
// is_foundation flag as params instead of re-fetching them -- the caller
// (toggleTaskCompletion) already has all three moments earlier, and this
// function used to silently re-query the same rows, tripling some of the
// round trips on every single task completion for no reason.
// Growth XP already earned in an Area on a day, counted against that Area's
// daily ceiling: task completions plus events marked "happened" that day.
async function areaGrowthXpAwardedOn(
  playerId: string,
  areaId: string,
  date: string,
): Promise<number> {
  const supabase = await createClient();

  const { data: areaTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("player_id", playerId)
    .eq("area_id", areaId);
  const areaTaskIds = (areaTasks ?? []).map((t) => t.id);

  const [{ data: todaysLogs }, { data: todaysEvents }] = await Promise.all([
    areaTaskIds.length > 0
      ? supabase
          .from("task_logs")
          .select("xp_awarded")
          .eq("player_id", playerId)
          .eq("completed_date", date)
          .eq("xp_type", "growth")
          .in("task_id", areaTaskIds)
      : Promise.resolve({ data: [] as { xp_awarded: number }[] }),
    supabase
      .from("events")
      .select("xp_awarded")
      .eq("player_id", playerId)
      .eq("area_id", areaId)
      .eq("status", "happened")
      .eq("resolved_on", date)
      .eq("xp_type", "growth"),
  ]);

  return [...(todaysLogs ?? []), ...(todaysEvents ?? [])].reduce(
    (sum, row) => sum + Number(row.xp_awarded),
    0,
  );
}

// XP for marking an event "happened": a Main Task's worth, capped by the
// Area's remaining daily ceiling like any other Growth XP. No Task
// Activation Delay -- an event can't be done ahead of time to begin with.
export async function computeXpForEvent(
  playerId: string,
  areaId: string,
  date: string,
  currentLevel: number,
  isFoundation: boolean,
): Promise<XpResult> {
  const ceiling = perAreaDailyXpCeiling(currentLevel, isFoundation);
  const alreadyAwarded = await areaGrowthXpAwardedOn(playerId, areaId, date);
  const remaining = Math.max(0, ceiling - alreadyAwarded);
  return { xpAwarded: Math.min(TIER_XP_MULTIPLIER.main_task, remaining), xpType: "growth" };
}

export async function computeXpForCompletion(
  playerId: string,
  taskId: string,
  date: string,
  currentLevel: number,
  task: { tier: string; area_id: string; source: string; activated_at: string },
  isFoundation: boolean,
): Promise<XpResult> {
  const baseXp = TIER_XP_MULTIPLIER[task.tier as Tier];

  const isExempt = task.source !== "custom";
  const activatedOnDate = getDateString(new Date(task.activated_at));
  if (!isExempt && activatedOnDate === date) {
    return { xpAwarded: baseXp, xpType: "bonus" };
  }

  const ceiling = perAreaDailyXpCeiling(currentLevel, isFoundation);

  const alreadyAwarded = await areaGrowthXpAwardedOn(playerId, task.area_id, date);
  const remaining = Math.max(0, ceiling - alreadyAwarded);

  return { xpAwarded: Math.min(baseXp, remaining), xpType: "growth" };
}
