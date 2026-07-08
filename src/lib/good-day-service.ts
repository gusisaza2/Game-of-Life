import { createClient } from "@/lib/supabase/server";
import {
  calculateCategoryPct,
  calculateGoodDayPct,
  isGoodDay,
} from "@/lib/good-day";
import { checkAndApplyLevelUp } from "@/lib/level-up-service";

type Tier = "habit" | "main_task" | "chore";

export type GoodDayResult = {
  date: string;
  habitPct: number;
  mainTaskPct: number;
  chorePct: number;
  goodDayPct: number;
  isGoodDay: boolean;
};

// Finalizes and persists the Good Day % for a single past day. Never
// computes "today" — Good Day status is only revealed once a day is over
// (CLAUDE.md UX principle: no live-ticking Good Day meter).
export async function getOrComputeGoodDay(
  playerId: string,
  date: string,
  todayDateString: string,
  earliestDateString: string,
): Promise<GoodDayResult | null> {
  if (date >= todayDateString || date < earliestDateString) return null;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("daily_good_days")
    .select("*")
    .eq("player_id", playerId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return {
      date: existing.date,
      habitPct: Number(existing.habit_pct),
      mainTaskPct: Number(existing.main_task_pct),
      chorePct: Number(existing.chore_pct),
      goodDayPct: Number(existing.good_day_pct),
      isGoodDay: existing.is_good_day,
    };
  }

  const [{ data: tasks }, { data: logs }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, tier")
      .eq("player_id", playerId)
      .eq("is_active", true),
    supabase
      .from("task_logs")
      .select("task_id")
      .eq("player_id", playerId)
      .eq("completed_date", date),
  ]);

  const completedIds = new Set((logs ?? []).map((log) => log.task_id));
  const byTier: Record<Tier, string[]> = { habit: [], main_task: [], chore: [] };
  for (const task of tasks ?? []) {
    byTier[task.tier as Tier].push(task.id);
  }

  const completedInTier = (tier: Tier) =>
    byTier[tier].filter((id) => completedIds.has(id)).length;

  const habitPct = calculateCategoryPct(byTier.habit.length, completedInTier("habit"));
  const mainTaskPct = calculateCategoryPct(
    byTier.main_task.length,
    completedInTier("main_task"),
  );
  const chorePct = calculateCategoryPct(byTier.chore.length, completedInTier("chore"));
  const goodDayPct = calculateGoodDayPct(habitPct, mainTaskPct, chorePct);
  const goodDay = isGoodDay(goodDayPct);

  await supabase.from("daily_good_days").upsert({
    player_id: playerId,
    date,
    habit_pct: habitPct,
    main_task_pct: mainTaskPct,
    chore_pct: chorePct,
    good_day_pct: goodDayPct,
    is_good_day: goodDay,
  });

  // Lifetime Good Day totals are immune to decay/edits — only ever
  // incremented here, the one time a day is finalized (CLAUDE.md).
  if (goodDay) {
    const { data: player } = await supabase
      .from("players")
      .select("lifetime_good_day_count")
      .eq("id", playerId)
      .single();
    if (player) {
      await supabase
        .from("players")
        .update({ lifetime_good_day_count: player.lifetime_good_day_count + 1 })
        .eq("id", playerId);
    }
  }

  await checkAndApplyLevelUp(playerId);

  return {
    date,
    habitPct,
    mainTaskPct,
    chorePct,
    goodDayPct,
    isGoodDay: goodDay,
  };
}
