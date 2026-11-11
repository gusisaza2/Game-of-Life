"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getNowTimeString, getTodayDateString } from "@/lib/today";
import { isValidDateString, shiftDate } from "@/lib/deadline";
import { durationMinutes, endTimeFor, overlaps, toMinutes, type Slot } from "@/lib/time-blocks";
import {
  RESCHEDULE_HORIZON_DAYS,
  proposeMoves,
  type DayLoad,
  type Placement,
  type ProposedMove,
} from "@/lib/reschedule";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function refresh() {
  for (const path of ["/", "/agenda", "/plan", "/manage"]) revalidatePath(path);
}

const later = (a: string, b: string) => (toMinutes(a) >= toMinutes(b) ? a : b);

// What's already on each day from `startDate` for `horizonDays` more days:
// events and blocks that stay put (minus the blocks being moved). Gives the
// reschedule logic its "busy" view of every day.
async function loadDays(
  playerId: string,
  startDate: string,
  excludeIds: string[],
  horizonDays = RESCHEDULE_HORIZON_DAYS,
): Promise<(date: string) => DayLoad> {
  const supabase = await createClient();
  const endDate = shiftDate(startDate, horizonDays);
  const [{ data: events }, { data: blocks }] = await Promise.all([
    supabase
      .from("events")
      .select("event_date, start_time, end_time")
      .eq("player_id", playerId)
      .in("status", ["scheduled", "happened"])
      .gte("event_date", startDate)
      .lte("event_date", endDate),
    supabase
      .from("time_blocks")
      .select("id, block_date, start_time, end_time")
      .eq("player_id", playerId)
      .in("status", ["planned", "done"])
      .gte("block_date", startDate)
      .lte("block_date", endDate),
  ]);

  const byDate = new Map<string, DayLoad>();
  const day = (date: string) => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const created: DayLoad = { busy: [], plannedMinutes: 0 };
    byDate.set(date, created);
    return created;
  };
  for (const e of events ?? []) {
    day(e.event_date).busy.push({ start: e.start_time, end: e.end_time });
  }
  for (const b of blocks ?? []) {
    if (excludeIds.includes(b.id)) continue;
    const load = day(b.block_date);
    load.busy.push({ start: b.start_time, end: b.end_time });
    load.plannedMinutes += durationMinutes(b.start_time, b.end_time);
  }
  return (date) => byDate.get(date) ?? { busy: [], plannedMinutes: 0 };
}

export type EventInWindow = { id: string; title: string; start: string; end: string };

// Step 1 of "Something came up": which work blocks does the surprise knock
// out, and where could each go instead? Read-only -- nothing changes until
// the player confirms (applyBlockMoves).
export async function proposeReschedule(
  playerId: string,
  date: string,
  from: string,
  to: string,
): Promise<{ moves: ProposedMove[]; events: EventInWindow[] }> {
  const empty = { moves: [], events: [] };
  const today = getTodayDateString();
  const now = getNowTimeString();
  if (!isValidDateString(date) || date < today) return empty;
  if (!TIME_PATTERN.test(from) || !TIME_PATTERN.test(to)) return empty;

  // Time that has already passed can't be re-planned.
  const windowStart = date === today ? later(from, now) : from;
  if (toMinutes(to) <= toMinutes(windowStart)) return empty;
  const window: Slot = { start: windowStart, end: to };

  const supabase = await createClient();
  const [{ data: blockRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("time_blocks")
      .select("id, start_time, end_time, tasks(title)")
      .eq("player_id", playerId)
      .eq("block_date", date)
      .eq("status", "planned")
      .order("start_time"),
    supabase
      .from("events")
      .select("id, title, start_time, end_time")
      .eq("player_id", playerId)
      .eq("event_date", date)
      .in("status", ["scheduled", "happened"])
      .order("start_time"),
  ]);

  // Many-to-one embeds come back as objects; supabase-js infers arrays.
  const affected = ((blockRows ?? []) as unknown as {
    id: string;
    start_time: string;
    end_time: string;
    tasks: { title: string } | null;
  }[]).filter((b) => overlaps({ start: b.start_time, end: b.end_time }, window));

  const loadFor = await loadDays(
    playerId,
    date,
    affected.map((b) => b.id),
  );
  const moves = proposeMoves({
    blocks: affected.map((b) => ({
      id: b.id,
      title: b.tasks?.title ?? "Task",
      date,
      start: b.start_time,
      end: b.end_time,
    })),
    windowEnd: to,
    today,
    now,
    loadFor,
  });

  const events = (eventRows ?? [])
    .filter((e) => overlaps({ start: e.start_time, end: e.end_time }, window))
    .map((e) => ({ id: e.id, title: e.title, start: e.start_time, end: e.end_time }));

  return { moves, events };
}

// Step 2: the player confirmed (some of) the proposal. Each move is checked
// again here, since time may have passed since it was proposed.
export async function applyBlockMoves(
  moves: { id: string; date: string; start: string; end: string }[],
): Promise<number> {
  const today = getTodayDateString();
  const supabase = await createClient();
  let applied = 0;

  for (const move of moves) {
    if (!isValidDateString(move.date) || move.date < today) continue;
    if (!TIME_PATTERN.test(move.start) || !TIME_PATTERN.test(move.end)) continue;
    if (toMinutes(move.end) <= toMinutes(move.start)) continue;

    const { error } = await supabase
      .from("time_blocks")
      .update({
        block_date: move.date,
        start_time: move.start,
        end_time: move.end,
        status: "planned",
        resolved_on: null,
        prompted_at: null,
      })
      .eq("id", move.id);
    if (!error) applied++;
  }

  refresh();
  return applied;
}

// Move one block to a specific day and time, keeping (or changing) its length.
export async function moveBlock(
  blockId: string,
  date: string,
  startTime: string,
  minutes: number,
): Promise<boolean> {
  if (!isValidDateString(date) || date < getTodayDateString()) return false;
  if (!TIME_PATTERN.test(startTime)) return false;
  const endTime = endTimeFor(startTime, minutes);
  if (!endTime) return false;

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_blocks")
    .update({
      block_date: date,
      start_time: startTime,
      end_time: endTime,
      status: "planned",
      resolved_on: null,
      prompted_at: null,
    })
    .eq("id", blockId);

  refresh();
  return !error;
}

// "Next free slot": the first gap after this block (or after now, if the
// block's time has already passed) that fits it -- today if there's room,
// otherwise the following days. Returns where it went, or null if it found
// no room (the block stays where it was).
export async function moveBlockToNextFree(
  playerId: string,
  blockId: string,
): Promise<Placement | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_blocks")
    .select("id, block_date, start_time, end_time, tasks(title)")
    .eq("id", blockId)
    .single();
  if (!data) return null;

  const block = data as unknown as {
    id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    tasks: { title: string } | null;
  };
  const today = getTodayDateString();
  const now = getNowTimeString();
  const startDate = block.block_date < today ? today : block.block_date;
  const loadFor = await loadDays(playerId, startDate, [block.id]);

  const [move] = proposeMoves({
    blocks: [
      {
        id: block.id,
        title: block.tasks?.title ?? "Task",
        date: block.block_date,
        start: block.start_time,
        end: block.end_time,
      },
    ],
    windowEnd: block.block_date === today ? later(block.end_time, now) : block.end_time,
    today,
    now,
    loadFor,
  });
  if (!move?.to) return null;

  await applyBlockMoves([{ id: block.id, ...move.to }]);
  return move.to;
}

// "Decide later" on the ended-block prompt: the question was asked, so it
// isn't asked again for this slot. The block stays in Today's Agenda.
export async function markBlockPrompted(blockId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("time_blocks")
    .update({ prompted_at: new Date().toISOString() })
    .eq("id", blockId)
    .is("prompted_at", null);
  refresh();
}

export type LateTask = { id: string; title: string; due_date: string };

// Reschedules an event (it changed outside the app: another day, another
// time). Prep tasks linked to it that now fall due on or after the new date
// are returned so the player can pull their deadlines in.
export async function moveEvent(
  eventId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ ok: boolean; lateTasks: LateTask[] }> {
  if (!isValidDateString(date) || date < getTodayDateString()) return { ok: false, lateTasks: [] };
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return { ok: false, lateTasks: [] };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ event_date: date, start_time: startTime, end_time: endTime })
    .eq("id", eventId);
  if (error) return { ok: false, lateTasks: [] };

  const { data: prep } = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("event_id", eventId)
    .is("done_date", null)
    .gte("due_date", date);

  refresh();
  return { ok: true, lateTasks: (prep ?? []) as LateTask[] };
}

// Pulls the open prep tasks of an event back to the day before it (or today,
// if the event is today or tomorrow).
export async function alignPrepDeadlines(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .single();
  if (!event) return 0;

  const today = getTodayDateString();
  const dayBefore = shiftDate(event.event_date, -1);
  const target = dayBefore < today ? today : dayBefore;

  const { data: updated } = await supabase
    .from("tasks")
    .update({ due_date: target })
    .eq("event_id", eventId)
    .is("done_date", null)
    .gte("due_date", event.event_date)
    .select("id");

  refresh();
  return updated?.length ?? 0;
}
