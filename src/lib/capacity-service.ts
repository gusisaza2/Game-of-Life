import { createClient } from "@/lib/supabase/server";
import { computeDecayedCapacity, capacityForLevel, GRACE_DAYS } from "@/lib/capacity";
import { perAreaDailyXpCeiling } from "@/lib/leveling";
import { daysBetween } from "@/lib/today";

// Recomputes and persists decay for one AreaCapacity row, on-read
// (CLAUDE.md build order: "on-read is simpler for MVP").
export async function refreshAreaCapacity(
  playerId: string,
  areaId: string,
  level: number,
  today: string,
  playerCreatedDate: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("area_capacities")
    .select("*")
    .eq("player_id", playerId)
    .eq("area_id", areaId)
    .single();
  if (!row) return;

  const lastActivity = row.last_activity_date ?? playerCreatedDate;
  const daysSinceActivity = daysBetween(lastActivity, today);
  const newCapacity = computeDecayedCapacity(level, daysSinceActivity);
  const decaying = daysSinceActivity > GRACE_DAYS;

  await supabase
    .from("area_capacities")
    .update({
      capacity: newCapacity,
      decay_cycle_start_date: decaying ? row.decay_cycle_start_date ?? lastActivity : null,
    })
    .eq("player_id", playerId)
    .eq("area_id", areaId);
}

export async function refreshAllAreaCapacities(
  playerId: string,
  level: number,
  today: string,
  playerCreatedDate: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: areas } = await supabase.from("areas").select("id");

  await Promise.all(
    (areas ?? []).map((area) =>
      refreshAreaCapacity(playerId, area.id, level, today, playerCreatedDate),
    ),
  );
}

export type AreaActivityResult = {
  bonusXp: number;
  // Snapshot of the row *before* this completion overwrote it, so an
  // un-complete can restore it exactly instead of leaving the reset stuck.
  prevCapacity: number;
  prevLastActivityDate: string | null;
  prevDecayCycleStartDate: string | null;
};

// Called when a task is completed. Resets the area's decay clock and, if
// the completion follows a genuine lapse (already decaying past the grace
// window), returns the 1x re-engagement bonus XP for that area.
export async function registerAreaActivity(
  playerId: string,
  areaId: string,
  isFoundation: boolean,
  level: number,
  today: string,
  playerCreatedDate: string,
): Promise<AreaActivityResult | null> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("area_capacities")
    .select("*")
    .eq("player_id", playerId)
    .eq("area_id", areaId)
    .single();
  if (!row) return null;

  const lastActivity = row.last_activity_date ?? playerCreatedDate;
  const daysSinceActivityBefore = daysBetween(lastActivity, today);
  const genuineLapse = daysSinceActivityBefore > GRACE_DAYS;
  const bonusXp = genuineLapse ? perAreaDailyXpCeiling(level, isFoundation) : 0;

  await supabase
    .from("area_capacities")
    .update({
      capacity: capacityForLevel(level),
      last_activity_date: today,
      decay_cycle_start_date: null,
    })
    .eq("player_id", playerId)
    .eq("area_id", areaId);

  return {
    bonusXp,
    prevCapacity: Number(row.capacity),
    prevLastActivityDate: row.last_activity_date,
    prevDecayCycleStartDate: row.decay_cycle_start_date,
  };
}

// Un-does registerAreaActivity's reset when a completion is undone.
// Guarded: only restores if last_activity_date is still what
// registerAreaActivity set it to (== the date the task was completed on)
// -- if something else touched this area since, leave it alone rather
// than clobber real, later activity.
export async function restoreAreaActivity(
  playerId: string,
  areaId: string,
  completedDate: string,
  snapshot: {
    prevCapacity: number;
    prevLastActivityDate: string | null;
    prevDecayCycleStartDate: string | null;
  },
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("area_capacities")
    .update({
      capacity: snapshot.prevCapacity,
      last_activity_date: snapshot.prevLastActivityDate,
      decay_cycle_start_date: snapshot.prevDecayCycleStartDate,
    })
    .eq("player_id", playerId)
    .eq("area_id", areaId)
    .eq("last_activity_date", completedDate);
}
