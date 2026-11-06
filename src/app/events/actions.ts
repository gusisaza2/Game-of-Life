"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeXpForEvent } from "@/lib/xp-service";
import { computeNivelUp, type NivelUpEvent } from "@/lib/nivel-service";
import { registerAreaActivity, restoreAreaActivity } from "@/lib/capacity-service";
import { getDateString, getNowTimeString, getTodayDateString } from "@/lib/today";
import { hasStarted } from "@/lib/events";
import { isValidDateString } from "@/lib/deadline";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function refresh() {
  revalidatePath("/");
  revalidatePath("/manage");
}

type EventFields = {
  areaId: string;
  milestoneId: string | null;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
};

// Returns null when anything required is missing or malformed.
function readEventFields(formData: FormData): EventFields | null {
  const title = String(formData.get("title") ?? "").trim();
  const areaId = String(formData.get("areaId") ?? "");
  const eventDate = String(formData.get("eventDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!title || !areaId) return null;
  if (!isValidDateString(eventDate)) return null;
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return null;
  return { areaId, milestoneId, title, eventDate, startTime, endTime, location };
}

export async function createEvent(formData: FormData): Promise<{ id: string } | null> {
  const playerId = String(formData.get("playerId"));
  const fields = readEventFields(formData);
  // A new event can't be scheduled in the past (logging one that already
  // happened isn't what this is for).
  if (!fields || fields.eventDate < getTodayDateString()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .insert({
      player_id: playerId,
      area_id: fields.areaId,
      milestone_id: fields.milestoneId,
      title: fields.title,
      event_date: fields.eventDate,
      start_time: fields.startTime,
      end_time: fields.endTime,
      location: fields.location,
    })
    .select("id")
    .single();

  refresh();
  return data ? { id: data.id } : null;
}

export async function updateEvent(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const fields = readEventFields(formData);
  if (!fields) return;

  const supabase = await createClient();
  await supabase
    .from("events")
    .update({
      area_id: fields.areaId,
      milestone_id: fields.milestoneId,
      title: fields.title,
      event_date: fields.eventDate,
      start_time: fields.startTime,
      end_time: fields.endTime,
      location: fields.location,
    })
    .eq("id", eventId);

  refresh();
}

// Permanent. Tasks prepared for it keep existing (their event link just
// clears). If it had been marked "happened", its XP is taken back first, the
// same as undoing it.
export async function deleteEvent(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const playerId = String(formData.get("playerId"));

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("status")
    .eq("id", eventId)
    .maybeSingle();
  if (event?.status === "happened") {
    await reopenEvent(eventId, playerId);
  }
  await supabase.from("events").delete().eq("id", eventId);

  refresh();
}

export type EventResolution = {
  xpAwarded: number;
  nivelUp: NivelUpEvent | null;
} | null;

// Marks how an event went: "happened" awards XP (a Main Task's worth, the
// Area's daily ceiling applying), "missed"/"cancelled" award nothing and
// carry no penalty. "scheduled" reopens it, taking back any XP it gave.
export async function setEventStatus(
  eventId: string,
  playerId: string,
  status: "scheduled" | "happened" | "missed" | "cancelled",
): Promise<EventResolution> {
  if (status === "scheduled") {
    await reopenEvent(eventId, playerId);
    refresh();
    return null;
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("area_id, status, event_date, start_time")
    .eq("id", eventId)
    .single();
  if (!event || event.status === status) return null;

  // Switching between outcomes (e.g. happened -> missed): undo the old one first.
  if (event.status !== "scheduled") await reopenEvent(eventId, playerId);

  const today = getTodayDateString();

  if (status !== "happened") {
    await supabase
      .from("events")
      .update({ status, resolved_on: today })
      .eq("id", eventId);
    refresh();
    return null;
  }

  // You can't have done it before it started.
  if (!hasStarted(event, today, getNowTimeString())) return null;

  const [{ data: player }, { data: area }] = await Promise.all([
    supabase
      .from("players")
      .select("current_level, cumulative_xp, created_at, last_nivel_reached")
      .eq("id", playerId)
      .single(),
    supabase.from("areas").select("is_foundation").eq("id", event.area_id).single(),
  ]);
  if (!player || !area) return null;

  const playerCreatedDate = getDateString(new Date(player.created_at));
  const [{ xpAwarded, xpType }, activity] = await Promise.all([
    computeXpForEvent(playerId, event.area_id, today, player.current_level, area.is_foundation),
    registerAreaActivity(
      playerId,
      event.area_id,
      area.is_foundation,
      player.current_level,
      today,
      playerCreatedDate,
    ),
  ]);
  const bonusXp = activity?.bonusXp ?? 0;

  await supabase
    .from("events")
    .update({
      status: "happened",
      resolved_on: today,
      xp_awarded: xpAwarded,
      xp_type: xpType,
      reengagement_bonus_xp: bonusXp,
      prev_area_capacity: activity?.prevCapacity ?? null,
      prev_area_last_activity_date: activity?.prevLastActivityDate ?? null,
      prev_area_decay_cycle_start_date: activity?.prevDecayCycleStartDate ?? null,
    })
    .eq("id", eventId);

  // Event XP is Growth XP (never Bonus), plus the re-engagement bonus if
  // this ended a real lapse in the Area.
  const growthXpEarned = xpAwarded + bonusXp;
  let nivelUp: NivelUpEvent | null = null;
  if (growthXpEarned > 0) {
    const newCumulativeXp = Number(player.cumulative_xp) + growthXpEarned;
    const { lastNivelReached, event: nivelEvent } = computeNivelUp({
      current_level: player.current_level,
      cumulative_xp: newCumulativeXp,
      last_nivel_reached: player.last_nivel_reached,
    });
    nivelUp = nivelEvent;
    await supabase
      .from("players")
      .update({ cumulative_xp: newCumulativeXp, last_nivel_reached: lastNivelReached })
      .eq("id", playerId);
  }

  refresh();
  return { xpAwarded, nivelUp };
}

// Puts an event back to "scheduled". If it had been marked "happened", the
// XP it awarded (and the Area's decay clock) are restored -- the same
// reversal a task un-completion does. Nivel is never revoked once reached.
async function reopenEvent(eventId: string, playerId: string) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "area_id, status, resolved_on, xp_awarded, xp_type, reengagement_bonus_xp, prev_area_capacity, prev_area_last_activity_date, prev_area_decay_cycle_start_date",
    )
    .eq("id", eventId)
    .single();
  if (!event || event.status === "scheduled") return;

  if (event.status === "happened") {
    const growthToReverse =
      (event.xp_type === "growth" ? Number(event.xp_awarded) : 0) +
      Number(event.reengagement_bonus_xp);

    if (growthToReverse > 0) {
      const { data: player } = await supabase
        .from("players")
        .select("cumulative_xp")
        .eq("id", playerId)
        .single();
      if (player) {
        await supabase
          .from("players")
          .update({ cumulative_xp: Math.max(0, Number(player.cumulative_xp) - growthToReverse) })
          .eq("id", playerId);
      }
    }

    if (event.prev_area_capacity !== null && event.resolved_on) {
      await restoreAreaActivity(playerId, event.area_id, event.resolved_on, {
        prevCapacity: Number(event.prev_area_capacity),
        prevLastActivityDate: event.prev_area_last_activity_date,
        prevDecayCycleStartDate: event.prev_area_decay_cycle_start_date,
      });
    }
  }

  await supabase
    .from("events")
    .update({
      status: "scheduled",
      resolved_on: null,
      xp_awarded: 0,
      xp_type: "growth",
      reengagement_bonus_xp: 0,
      prev_area_capacity: null,
      prev_area_last_activity_date: null,
      prev_area_decay_cycle_start_date: null,
    })
    .eq("id", eventId);
}
