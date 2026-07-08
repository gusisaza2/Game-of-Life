import { createClient } from "@/lib/supabase/server";
import { getGateForLevel } from "@/lib/level-gates";
import { getDateString } from "@/lib/today";

// Checks the hybrid Good Day → Level-up gate (CLAUDE.md "Core formulas" #7)
// and advances the player's level if all three conditions are met:
//   1. cumulative_xp >= xp_threshold_for_level
//   2. lifetime_good_day_count >= gd_threshold
//   3. good_days_in_rolling_window / window >= rate_floor
export async function checkAndApplyLevelUp(playerId: string): Promise<void> {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();
  if (!player) return;

  const gate = getGateForLevel(player.current_level);
  if (!gate) return; // No gate defined past MVP scope — level stays capped.

  if (gate.xpThreshold !== null && Number(player.cumulative_xp) < gate.xpThreshold) {
    return;
  }
  if (player.lifetime_good_day_count < gate.goodDayThreshold) return;

  const today = new Date();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - gate.rollingWindowDays);

  const { count } = await supabase
    .from("daily_good_days")
    .select("*", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("is_good_day", true)
    .gte("date", getDateString(windowStart))
    .lt("date", getDateString(today));

  const rate = (count ?? 0) / gate.rollingWindowDays;
  if (rate < gate.rateFloor) return;

  await supabase
    .from("players")
    .update({
      current_level: gate.toLevel,
      tutorial_complete: gate.fromLevel === 0 ? true : player.tutorial_complete,
    })
    .eq("id", playerId);
}
