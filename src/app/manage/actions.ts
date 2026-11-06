"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateString, getTomorrowDateString } from "@/lib/today";
import { isValidDateString, needsDeadline } from "@/lib/deadline";

// Main Tasks require a Milestone (enforced again by the DB trigger).
// Habits may optionally link to one; Chores never do (CLAUDE.md 8.2).
function resolveMilestoneId(tier: string, milestoneId: string): string | null {
  if (tier === "main_task") return milestoneId || null;
  if (tier === "habit") return milestoneId || null;
  return null;
}

// Main Tasks and Chores are one-off and always carry a deadline; Habits
// recur and never do. A dated task's recurrence is meaningless (it's done
// once, then done for good), so it's stored as the column default.
// Returns null when a required deadline is missing or isn't a real date.
function resolveDeadline(tier: string, formData: FormData): { dueDate: string | null } | null {
  if (!needsDeadline(tier)) return { dueDate: null };
  const raw = String(formData.get("dueDate") ?? "");
  return isValidDateString(raw) ? { dueDate: raw } : null;
}

// Only one-off tasks can prepare for an event; a habit never does.
function resolveEventId(tier: string, formData: FormData): string | null {
  if (!needsDeadline(tier)) return null;
  return String(formData.get("eventId") ?? "") || null;
}

function resolveRecurrence(tier: string, formData: FormData): string {
  return needsDeadline(tier) ? "daily" : String(formData.get("recurrence") ?? "daily");
}

export async function createGoal(formData: FormData): Promise<{ id: string } | null> {
  const playerId = String(formData.get("playerId"));
  const title = String(formData.get("title") ?? "").trim();
  const areaId = String(formData.get("areaId"));
  const secondaryAreaIds = formData.getAll("secondaryAreaIds").map(String);

  if (!title || !areaId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .insert({
      player_id: playerId,
      area_id: areaId,
      secondary_area_ids: secondaryAreaIds.filter((id) => id !== areaId),
      title,
      status: "active",
      source: "custom",
    })
    .select("id")
    .single();

  revalidatePath("/manage");
  return data ? { id: data.id } : null;
}

export async function setGoalStatus(formData: FormData) {
  const goalId = String(formData.get("goalId"));
  const status = String(formData.get("status"));

  const supabase = await createClient();
  await supabase.from("goals").update({ status }).eq("id", goalId);

  revalidatePath("/manage");
  revalidatePath("/");
}

// Permanent, unlike Complete/Abandon -- also removes every Milestone under
// the Goal, every Task linked to those Milestones, and every event under
// them (task_logs cascades on task delete, same as deleteTask below).
// Deleted explicitly and in
// dependency order rather than relying on DB cascade rules, since a Main
// Task can never exist with a null milestone_id (CLAUDE.md's validation
// rule) -- leaving one dangling by only deleting the Milestone would be
// invalid state, not an edge case to guard against.
export async function deleteGoal(formData: FormData) {
  const goalId = String(formData.get("goalId"));
  const supabase = await createClient();

  const { data: milestones } = await supabase
    .from("milestones")
    .select("id")
    .eq("goal_id", goalId);
  const milestoneIds = (milestones ?? []).map((m) => m.id);

  if (milestoneIds.length > 0) {
    await supabase.from("tasks").delete().in("milestone_id", milestoneIds);
    await supabase.from("events").delete().in("milestone_id", milestoneIds);
    await supabase.from("milestones").delete().eq("goal_id", goalId);
  }
  await supabase.from("goals").delete().eq("id", goalId);

  revalidatePath("/manage");
  revalidatePath("/");
}

export async function createMilestone(formData: FormData): Promise<{ id: string } | null> {
  const goalId = String(formData.get("goalId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return null;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("milestones")
    .select("order_index")
    .eq("goal_id", goalId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderIndex = (existing?.order_index ?? 0) + 1;

  const { data } = await supabase
    .from("milestones")
    .insert({
      goal_id: goalId,
      title,
      order_index: nextOrderIndex,
      status: "active",
    })
    .select("id")
    .single();

  revalidatePath("/manage");
  return data ? { id: data.id } : null;
}

export async function createTask(formData: FormData): Promise<{ id: string } | null> {
  const playerId = String(formData.get("playerId"));
  const title = String(formData.get("title") ?? "").trim();
  const tier = String(formData.get("tier"));
  const areaId = String(formData.get("areaId"));
  const recurrence = resolveRecurrence(tier, formData);
  const milestoneIdRaw = formData.get("milestoneId");
  const milestoneId = milestoneIdRaw ? String(milestoneIdRaw) : "";
  // Tasks added inline under a Milestone default to inactive (planned for
  // later, not due now) unless the form explicitly checks "Activate now".
  // The standalone Add Task form always sends "true" here, preserving its
  // existing immediate-activation behavior.
  const isActive = formData.get("isActive") !== "false";

  if (!title || !areaId) return null;
  if (tier === "main_task" && !milestoneId) return null;

  const deadline = resolveDeadline(tier, formData);
  // A brand-new task can't be given a deadline that has already passed.
  if (!deadline || (deadline.dueDate && deadline.dueDate < getTodayDateString())) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .insert({
      player_id: playerId,
      milestone_id: resolveMilestoneId(tier, milestoneId),
      area_id: areaId,
      tier,
      title,
      recurrence,
      due_date: deadline.dueDate,
      event_id: resolveEventId(tier, formData),
      is_active: isActive,
    })
    .select("id")
    .single();

  revalidatePath("/manage");
  revalidatePath("/");
  return data ? { id: data.id } : null;
}

export async function updateTask(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const title = String(formData.get("title") ?? "").trim();
  const tier = String(formData.get("tier"));
  const areaId = String(formData.get("areaId"));
  const recurrence = resolveRecurrence(tier, formData);
  const milestoneIdRaw = formData.get("milestoneId");
  const milestoneId = milestoneIdRaw ? String(milestoneIdRaw) : "";

  if (!title || !areaId) return;
  if (tier === "main_task" && !milestoneId) return;

  // Unlike creating, editing may keep a deadline that has already passed
  // (an overdue task is renamed or re-linked without being rescheduled).
  const deadline = resolveDeadline(tier, formData);
  if (!deadline) return;

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      title,
      tier,
      area_id: areaId,
      recurrence,
      due_date: deadline.dueDate,
      event_id: resolveEventId(tier, formData),
      milestone_id: resolveMilestoneId(tier, milestoneId),
    })
    .eq("id", taskId);

  revalidatePath("/manage");
  revalidatePath("/");
}

// Gives an existing task its deadline (or moves it). Used by the "Needs a
// deadline" list, and to reschedule an overdue task. Rescheduling a task that
// was already marked done reopens nothing -- it stays done; only the date
// changes.
export async function setTaskDueDate(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!isValidDateString(dueDate)) return;

  const supabase = await createClient();
  await supabase.from("tasks").update({ due_date: dueDate }).eq("id", taskId).neq("tier", "habit");

  revalidatePath("/manage");
  revalidatePath("/");
}

export async function setTaskActive(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  // Activating a task resets its activation clock, so a backlog Task
  // planned weeks ago still goes through the same day-of/day-after
  // Activation Delay as one created fresh today (CLAUDE.md #9).
  // Deactivating leaves activated_at untouched — it's irrelevant while
  // inactive, and reactivating later will reset it again anyway.
  const update = isActive
    ? { is_active: true, activated_at: new Date().toISOString(), scheduled_activation_date: null }
    : { is_active: false };
  await supabase.from("tasks").update(update).eq("id", taskId);

  revalidatePath("/manage");
  revalidatePath("/");
}

// "Activate tomorrow": leaves the task inactive today but marks it to turn
// itself on the next time the app is opened on or after tomorrow (see
// scheduled-activation-service.ts). Passing null clears a pending
// schedule instead ("un-schedule").
export async function scheduleTaskActivation(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const scheduled = formData.get("scheduled") === "true";

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ scheduled_activation_date: scheduled ? getTomorrowDateString() : null })
    .eq("id", taskId);

  revalidatePath("/manage");
  revalidatePath("/");
}

// Permanent, unlike Deactivate — also removes the task's completion
// history (task_logs cascades on delete). Distinct from "inactive": an
// inactive Task is still planned for later, a deleted one is gone.
export async function deleteTask(formData: FormData) {
  const taskId = String(formData.get("taskId"));

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", taskId);

  revalidatePath("/manage");
  revalidatePath("/");
}
