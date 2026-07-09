import { createClient } from "@/lib/supabase/server";
import {
  calculateCategoryPct,
  calculateGoodDayPct,
  isGoodDay,
} from "@/lib/good-day";
import { computeLevelUp, type PlayerLevelState } from "@/lib/level-up-service";
import { getGateForLevel } from "@/lib/level-gates";
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

// Computes (or returns the cached) Good Day % for a single past day. Never
// computes "today" — Good Day status is only revealed once a day is over
// (CLAUDE.md UX principle: no live-ticking Good Day meter). Pure w.r.t. the
// player row — does NOT touch lifetime_good_day_count or Chapter; the
// caller (backfillGoodDays) owns that state so it can be threaded
// in-memory across many days in one request instead of re-read per day.
async function computeOrGetGoodDay(
  playerId: string,
  date: string,
  todayDateString: string,
): Promise<{ result: GoodDayResult; isNew: boolean } | null> {
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
      isNew: false,
      result: {
        date: existing.date,
        habitPct: Number(existing.habit_pct),
        mainTaskPct: Number(existing.main_task_pct),
        chorePct: Number(existing.chore_pct),
        goodDayPct: Number(existing.good_day_pct),
        isGoodDay: existing.is_good_day,
      },
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

  return {
    isNew: true,
    result: { date, habitPct, mainTaskPct, chorePct, goodDayPct, isGoodDay: goodDay },
  };
}

// Finalizes every day from the last-finalized day (exclusive) — or the
// player's creation date, if none is finalized yet — through yesterday,
// inclusive. Without this, a player who skips opening the app for several
// days would never have those in-between days finalized: lifetime Good Day
// count would silently undercount, and the rolling-window rate used by the
// Chapter-up gate would be skewed by phantom gaps.
//
// Reads the player row and the rolling-window Good Day count exactly once
// up front, then threads that state through the loop in memory, writing
// back once at the end. This is deliberate, not an optimization: React
// Server Components memoize identical fetch() calls within a single
// render, so re-reading the same player row (or the same window count
// query) on every iteration would silently return the first iteration's
// stale snapshot on every subsequent call.
export async function backfillGoodDays(
  playerId: string,
  todayDateString: string,
  earliestDateString: string,
): Promise<{ results: GoodDayResult[]; player: PlayerLevelState | null }> {
  const supabase = await createClient();

  const { data: playerRow } = await supabase
    .from("players")
    .select("current_level, cumulative_xp, lifetime_good_day_count, last_nivel_reached")
    .eq("id", playerId)
    .single();
  if (!playerRow) return { results: [], player: null };

  const yesterday = addDays(todayDateString, -1);
  if (yesterday < earliestDateString) {
    return {
      results: [],
      player: {
        current_level: playerRow.current_level,
        cumulative_xp: Number(playerRow.cumulative_xp),
        lifetime_good_day_count: playerRow.lifetime_good_day_count,
        last_nivel_reached: playerRow.last_nivel_reached,
      },
    };
  }

  let player: PlayerLevelState = {
    current_level: playerRow.current_level,
    cumulative_xp: Number(playerRow.cumulative_xp),
    lifetime_good_day_count: playerRow.lifetime_good_day_count,
    last_nivel_reached: playerRow.last_nivel_reached,
  };
  const initialState = { ...player };

  const { data: lastFinalized } = await supabase
    .from("daily_good_days")
    .select("date")
    .eq("player_id", playerId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startDate = lastFinalized ? addDays(lastFinalized.date, 1) : earliestDateString;

  // Seed the rolling-window Good Day count once from currently-persisted
  // data, then adjust incrementally as new days are finalized below
  // (rather than re-querying, for the same memoization reason as above).
  const initialGate = getGateForLevel(player.current_level);
  let windowStartString = "";
  let windowGoodDayCount = 0;
  if (initialGate) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - initialGate.rollingWindowDays);
    windowStartString = getDateString(windowStart);
    const { count } = await supabase
      .from("daily_good_days")
      .select("*", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("is_good_day", true)
      .gte("date", windowStartString)
      .lt("date", todayDateString);
    windowGoodDayCount = count ?? 0;
  }

  const results: GoodDayResult[] = [];

  for (const date of dateRange(startDate, yesterday)) {
    const outcome = await computeOrGetGoodDay(playerId, date, todayDateString);
    if (!outcome) continue;
    results.push(outcome.result);
    if (!outcome.isNew || !outcome.result.isGoodDay) continue;

    // Lifetime Good Day totals are immune to decay/edits — only ever
    // incremented here, the one time a day is finalized (CLAUDE.md).
    player = { ...player, lifetime_good_day_count: player.lifetime_good_day_count + 1 };
    if (date >= windowStartString) windowGoodDayCount += 1;

    player = computeLevelUp(player, windowGoodDayCount);
  }

  const changed =
    player.current_level !== initialState.current_level ||
    player.lifetime_good_day_count !== initialState.lifetime_good_day_count ||
    player.last_nivel_reached !== initialState.last_nivel_reached;

  if (changed) {
    await supabase
      .from("players")
      .update({
        current_level: player.current_level,
        lifetime_good_day_count: player.lifetime_good_day_count,
        last_nivel_reached: player.last_nivel_reached,
      })
      .eq("id", playerId);
  }

  return { results, player };
}

// Convenience for the Today view: backfills any unfinalized backlog, then
// returns yesterday's finalized status (from the backfill if it was just
// computed, or from its cached row if it already was) and the player's
// up-to-date state — the caller should use this `player` for display
// instead of a `player` object fetched before this call, since it may now
// be stale (see the note on backfillGoodDays above re: request
// memoization).
export async function getYesterdayGoodDay(
  playerId: string,
  todayDateString: string,
  earliestDateString: string,
): Promise<{
  goodDay: GoodDayResult | null;
  player: PlayerLevelState | null;
}> {
  const { results, player } = await backfillGoodDays(playerId, todayDateString, earliestDateString);

  const yesterday = addDays(todayDateString, -1);
  const fromBackfill = results.find((result) => result.date === yesterday);
  if (fromBackfill) return { goodDay: fromBackfill, player };
  if (yesterday < earliestDateString) return { goodDay: null, player };

  const outcome = await computeOrGetGoodDay(playerId, yesterday, todayDateString);
  return { goodDay: outcome?.result ?? null, player };
}
