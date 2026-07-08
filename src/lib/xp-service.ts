import { createClient } from "@/lib/supabase/server";
import { perAreaDailyXpCeiling, TIER_XP_MULTIPLIER } from "@/lib/leveling";

type Tier = keyof typeof TIER_XP_MULTIPLIER;

// XP for a single task completion, capped at that area's remaining daily
// ceiling for the day. Overflow is explicitly out of scope for MVP
// (CLAUDE.md: "can hardcode 'no overflow yet' — just cap XP at the daily
// ceiling for now").
export async function computeXpForCompletion(
  playerId: string,
  taskId: string,
  date: string,
): Promise<number> {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("current_level")
    .eq("id", playerId)
    .single();
  const { data: task } = await supabase
    .from("tasks")
    .select("tier, area_id")
    .eq("id", taskId)
    .single();
  if (!player || !task) return 0;

  const { data: area } = await supabase
    .from("areas")
    .select("is_foundation")
    .eq("id", task.area_id)
    .single();
  if (!area) return 0;

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
    .in("task_id", areaTaskIds.length > 0 ? areaTaskIds : [taskId]);

  const alreadyAwarded = (todaysLogs ?? []).reduce(
    (sum, log) => sum + Number(log.xp_awarded),
    0,
  );
  const remaining = Math.max(0, ceiling - alreadyAwarded);
  const baseXp = TIER_XP_MULTIPLIER[task.tier as Tier];

  return Math.min(baseXp, remaining);
}
