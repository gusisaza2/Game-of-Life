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
// Task Activation Delay (CLAUDE.md #9 / design doc 6.5): a task created
// today, completed today, that isn't exempt (Path template / system
// content) earns Bonus XP instead — full tier value, but uncapped by the
// area ceiling and excluded from cumulative_xp, since it doesn't feed
// Growth-phase leveling.
export async function computeXpForCompletion(
  playerId: string,
  taskId: string,
  date: string,
): Promise<XpResult> {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("current_level")
    .eq("id", playerId)
    .single();
  const { data: task } = await supabase
    .from("tasks")
    .select("tier, area_id, source, created_at")
    .eq("id", taskId)
    .single();
  if (!player || !task) return { xpAwarded: 0, xpType: "growth" };

  const baseXp = TIER_XP_MULTIPLIER[task.tier as Tier];

  const isExempt = task.source !== "custom";
  const createdOnDate = getDateString(new Date(task.created_at));
  if (!isExempt && createdOnDate === date) {
    return { xpAwarded: baseXp, xpType: "bonus" };
  }

  const { data: area } = await supabase
    .from("areas")
    .select("is_foundation")
    .eq("id", task.area_id)
    .single();
  if (!area) return { xpAwarded: 0, xpType: "growth" };

  const ceiling = perAreaDailyXpCeiling(player.current_level, area.is_foundation);

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
