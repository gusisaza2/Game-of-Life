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
export async function computeXpForCompletion(
  playerId: string,
  taskId: string,
  date: string,
  currentLevel: number,
  task: { tier: string; area_id: string; source: string; activated_at: string },
  isFoundation: boolean,
): Promise<XpResult> {
  const supabase = await createClient();

  const baseXp = TIER_XP_MULTIPLIER[task.tier as Tier];

  const isExempt = task.source !== "custom";
  const activatedOnDate = getDateString(new Date(task.activated_at));
  if (!isExempt && activatedOnDate === date) {
    return { xpAwarded: baseXp, xpType: "bonus" };
  }

  const ceiling = perAreaDailyXpCeiling(currentLevel, isFoundation);

  const { data: areaTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("player_id", playerId)
    .eq("area_id", task.area_id);
  const areaTaskIds = (areaTasks ?? []).map((t) => t.id);

  const { data: todaysLogs } = await supabase
    .from("task_logs")
    .select("xp_awarded")
    .eq("player_id", playerId)
    .eq("completed_date", date)
    .eq("xp_type", "growth")
    .in("task_id", areaTaskIds.length > 0 ? areaTaskIds : [taskId]);

  const alreadyAwarded = (todaysLogs ?? []).reduce(
    (sum, log) => sum + Number(log.xp_awarded),
    0,
  );
  const remaining = Math.max(0, ceiling - alreadyAwarded);

  return { xpAwarded: Math.min(baseXp, remaining), xpType: "growth" };
}
