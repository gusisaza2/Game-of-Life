import { createClient } from "@/lib/supabase/server";
import { getGateForLevel } from "@/lib/level-gates";
import { getDateString } from "@/lib/today";

export type PlayerLevelState = {
  current_level: number;
  cumulative_xp: number;
  lifetime_good_day_count: number;
  tutorial_complete: boolean;
  last_nivel_reached: number;
};

// Pure decision: checks the hybrid Good Day → Level-up gate (CLAUDE.md
// "Core formulas" #7) and returns the (possibly advanced) player state.
// No I/O — callers that process many days in one request (the Good Day
// backfill loop) must pass an in-memory running state and an
// already-known rolling-window count rather than have this re-read the
// DB, since React Server Components memoize identical fetch() calls
// within a single render and would otherwise silently return the same
// stale row on every call.
export function computeLevelUp(
  player: PlayerLevelState,
  goodDaysInRollingWindow: number,
): PlayerLevelState {
  const gate = getGateForLevel(player.current_level);
  if (!gate) return player; // No gate defined past MVP scope — level stays capped.

  if (gate.xpThreshold !== null && player.cumulative_xp < gate.xpThreshold) return player;
  if (player.lifetime_good_day_count < gate.goodDayThreshold) return player;

  const rate = goodDaysInRollingWindow / gate.rollingWindowDays;
  if (rate < gate.rateFloor) return player;

  return {
    ...player,
    current_level: gate.toLevel,
    tutorial_complete: gate.fromLevel === 0 ? true : player.tutorial_complete,
    // Nivel is scoped to the current Chapter — reset on every advance
    // (design doc Section 7.5).
    last_nivel_reached: 0,
  };
}

// DB-orchestrating wrapper for single-shot call sites (one task completion
// = one read + one write, so it isn't exposed to the memoization hazard
// above). The backfill loop in good-day-service.ts does NOT use this —
// it uses computeLevelUp directly against in-memory state.
export async function checkAndApplyLevelUp(playerId: string): Promise<void> {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("current_level, cumulative_xp, lifetime_good_day_count, tutorial_complete, last_nivel_reached")
    .eq("id", playerId)
    .single();
  if (!player) return;

  const gate = getGateForLevel(player.current_level);
  if (!gate) return;

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

  const updated = computeLevelUp(
    {
      current_level: player.current_level,
      cumulative_xp: Number(player.cumulative_xp),
      lifetime_good_day_count: player.lifetime_good_day_count,
      tutorial_complete: player.tutorial_complete,
      last_nivel_reached: player.last_nivel_reached,
    },
    count ?? 0,
  );

  if (updated.current_level === player.current_level) return;

  await supabase
    .from("players")
    .update({
      current_level: updated.current_level,
      tutorial_complete: updated.tutorial_complete,
      last_nivel_reached: updated.last_nivel_reached,
    })
    .eq("id", playerId);
}
