"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateString, getTomorrowDateString } from "@/lib/today";
import { isValidDateString } from "@/lib/deadline";
import { endTimeFor } from "@/lib/time-blocks";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function refresh() {
  revalidatePath("/");
  revalidatePath("/plan");
}

type BlockFields = { blockDate: string; startTime: string; endTime: string };

// Reads date + start time + duration; null if anything is malformed or the
// block wouldn't fit inside the day.
function readBlockFields(formData: FormData): BlockFields | null {
  const blockDate = String(formData.get("blockDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const minutes = Number(formData.get("durationMinutes"));
  if (!isValidDateString(blockDate) || !TIME_PATTERN.test(startTime)) return null;
  const endTime = endTimeFor(startTime, minutes);
  return endTime ? { blockDate, startTime, endTime } : null;
}

export async function createBlock(formData: FormData): Promise<{ id: string } | null> {
  const playerId = String(formData.get("playerId"));
  const taskId = String(formData.get("taskId"));
  const fields = readBlockFields(formData);
  // Time can only be set aside from today on.
  if (!fields || fields.blockDate < getTodayDateString()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("time_blocks")
    .insert({
      player_id: playerId,
      task_id: taskId,
      block_date: fields.blockDate,
      start_time: fields.startTime,
      end_time: fields.endTime,
    })
    .select("id")
    .single();

  refresh();
  return data ? { id: data.id } : null;
}

export async function updateBlock(formData: FormData) {
  const blockId = String(formData.get("blockId"));
  const fields = readBlockFields(formData);
  if (!fields) return;

  const supabase = await createClient();
  await supabase
    .from("time_blocks")
    .update({
      block_date: fields.blockDate,
      start_time: fields.startTime,
      end_time: fields.endTime,
      status: "planned",
      resolved_on: null,
      // A new time is a new occasion to ask "did you work on it?".
      prompted_at: null,
    })
    .eq("id", blockId);

  refresh();
}

export async function deleteBlock(formData: FormData) {
  const blockId = String(formData.get("blockId"));
  const supabase = await createClient();
  await supabase.from("time_blocks").delete().eq("id", blockId);
  refresh();
}

// How a block went: used ("done"), not used ("skipped"), or back to planned.
// No XP and no penalty either way.
export async function setBlockStatus(blockId: string, status: "planned" | "done" | "skipped") {
  const supabase = await createClient();
  await supabase
    .from("time_blocks")
    .update({ status, resolved_on: status === "planned" ? null : getTodayDateString() })
    .eq("id", blockId);
  refresh();
}

// One tap for "I didn't get to it": same times, tomorrow, planned again.
export async function moveBlockToTomorrow(blockId: string) {
  const supabase = await createClient();
  await supabase
    .from("time_blocks")
    .update({ block_date: getTomorrowDateString(), status: "planned", resolved_on: null, prompted_at: null })
    .eq("id", blockId);
  refresh();
}
