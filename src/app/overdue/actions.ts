"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidDateString } from "@/lib/deadline";
import { getTodayDateString } from "@/lib/today";

// Gives many open Missions/Chores new deadlines in one go ("these dates have
// passed -- move them"). Only dates from today on are accepted, and only
// tasks that still have a deadline to move: never habits, never finished ones.
// Returns how many tasks were actually updated.
export async function rescheduleTasks(updates: { id: string; dueDate: string }[]): Promise<number> {
  const today = getTodayDateString();
  const valid = updates.filter((u) => typeof u.id === "string" && isValidDateString(u.dueDate) && u.dueDate >= today);
  if (valid.length === 0) return 0;

  const supabase = await createClient();
  const { data: movable } = await supabase
    .from("tasks")
    .select("id")
    .in("id", valid.map((u) => u.id))
    .neq("tier", "habit")
    .is("done_date", null);
  const movableIds = new Set((movable ?? []).map((t) => t.id));

  // One update per distinct date.
  const byDate = new Map<string, string[]>();
  for (const u of valid) {
    if (!movableIds.has(u.id)) continue;
    byDate.set(u.dueDate, [...(byDate.get(u.dueDate) ?? []), u.id]);
  }
  let moved = 0;
  for (const [dueDate, ids] of byDate) {
    const { data } = await supabase.from("tasks").update({ due_date: dueDate }).in("id", ids).select("id");
    moved += data?.length ?? 0;
  }

  for (const path of ["/", "/manage", "/plan"]) revalidatePath(path);
  return moved;
}
