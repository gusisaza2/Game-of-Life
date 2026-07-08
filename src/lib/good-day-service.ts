import { createClient } from "@/lib/supabase/server";
import {
  calculateCategoryPct,
  calculateGoodDayPct,
  isGoodDay,
} from "@/lib/good-day";
import { checkAndApplyLevelUp } from "@/lib/level-up-service";
import { getDateString } from "@/lib/today";

type Tier = "habit" | "main_task" | "chore";

export type GoodDayResult = {
  date: string;
  habitPct: number;
  mainTaskPct: number;
  chorePct: number;
  goodDayPct: number;
  isGoodDay: boolean;
};

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getDateString(date);
}

// Date strings are zero-padded ISO (YYYY-MM-DD), so lexicographic order
// matches calendar order.
function dateRange(startDate: string, endDateInclusive: string): string[] {
  const dates: string[] = [];
  for (let current = startDate; current <= endDateInclusive; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

// Finalizes and persists the Good Day % for a single past day. Never
// computes "today" — Good Day status is only revealed once a day is over
// (CLAUDE.md UX principle: no live-ticking Good Day meter). Idempotent: an
// already-finalized day is returned from its cached row, not recomputed.
async function getOrComputeGoodDayForDate(
  playerId: string,
  date: string,
  todayDateString: string,
): Promise<GoodDayResult | null> {
  if (date >= todayDateString) return null;

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

// Finalizes every day from the last-finalized day (exclusive) — or the
// player's creation date, if none is finalized yet — through yesterday,
// inclusive. Without this, a player who skips opening the app for several
// days would never have those in-between days finalized: lifetime Good Day
// count would silently undercount, and the rolling-window rate used by the
// Level-up gate would be skewed by phantom gaps.
export async function backfillGoodDays(
  playerId: string,
  todayDateString: string,
  earliestDateString: string,
): Promise<GoodDayResult[]> {
  const yesterday = addDays(todayDateString, -1);
  if (yesterday < earliestDateString) return [];

  const supabase = await createClient();
  const { data: lastFinalized } = await supabase
    .from("daily_good_days")
    .select("date")
    .eq("player_id", playerId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startDate = lastFinalized ? addDays(lastFinalized.date, 1) : earliestDateString;

  const results: GoodDayResult[] = [];
  for (const date of dateRange(startDate, yesterday)) {
    // Sequential, not parallel: each day's lifetime-count increment and
    // level-up check must see the previous day's effects.
    const result = await getOrComputeGoodDayForDate(playerId, date, todayDateString);
    if (result) results.push(result);
  }
  return results;
}

// Convenience for the Today view: backfills any unfinalized backlog, then
// returns yesterday's finalized status (from the backfill if it was just
// computed, or from its cached row if it already was).
export async function getYesterdayGoodDay(
  playerId: string,
  todayDateString: string,
  earliestDateString: string,
): Promise<GoodDayResult | null> {
  const yesterday = addDays(todayDateString, -1);
  if (yesterday < earliestDateString) return null;

  const backfilled = await backfillGoodDays(playerId, todayDateString, earliestDateString);
  const fromBackfill = backfilled.find((result) => result.date === yesterday);
  if (fromBackfill) return fromBackfill;

  return getOrComputeGoodDayForDate(playerId, yesterday, todayDateString);
}
