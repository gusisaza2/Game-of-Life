"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createGoal(formData: FormData) {
  const playerId = String(formData.get("playerId"));
  const title = String(formData.get("title") ?? "").trim();
  const areaId = String(formData.get("areaId"));
  const secondaryAreaIds = formData.getAll("secondaryAreaIds").map(String);

  if (!title || !areaId) return;

  const supabase = await createClient();
  await supabase.from("goals").insert({
    player_id: playerId,
    area_id: areaId,
    secondary_area_ids: secondaryAreaIds.filter((id) => id !== areaId),
    title,
    status: "active",
    source: "custom",
  });

  revalidatePath("/manage");
}

export async function setGoalStatus(formData: FormData) {
  const goalId = String(formData.get("goalId"));
  const status = String(formData.get("status"));

  const supabase = await createClient();
  await supabase.from("goals").update({ status }).eq("id", goalId);

  revalidatePath("/manage");
  revalidatePath("/");
}

export async function createMilestone(formData: FormData) {
  const goalId = String(formData.get("goalId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("milestones")
    .select("order_index")
    .eq("goal_id", goalId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderIndex = (existing?.order_index ?? 0) + 1;

  await supabase.from("milestones").insert({
    goal_id: goalId,
    title,
    order_index: nextOrderIndex,
    status: "active",
  });

  revalidatePath("/manage");
}

export async function createTask(formData: FormData) {
  const playerId = String(formData.get("playerId"));
  const title = String(formData.get("title") ?? "").trim();
  const tier = String(formData.get("tier"));
  const areaId = String(formData.get("areaId"));
  const recurrence = String(formData.get("recurrence"));
  const milestoneIdRaw = formData.get("milestoneId");
  const milestoneId = milestoneIdRaw ? String(milestoneIdRaw) : "";

  if (!title || !areaId) return;
  if (tier === "main_task" && !milestoneId) return;

  // Main Tasks require a Milestone (enforced again by the DB trigger).
  // Habits may optionally link to one; Chores never do (CLAUDE.md 8.2).
  let resolvedMilestoneId: string | null = null;
  if (tier === "main_task") {
    resolvedMilestoneId = milestoneId;
  } else if (tier === "habit" && milestoneId) {
    resolvedMilestoneId = milestoneId;
  }

  const supabase = await createClient();
  await supabase.from("tasks").insert({
    player_id: playerId,
    milestone_id: resolvedMilestoneId,
    area_id: areaId,
    tier,
    title,
    recurrence,
    is_active: true,
  });

  revalidatePath("/manage");
  revalidatePath("/");
}

export async function setTaskActive(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  await supabase.from("tasks").update({ is_active: isActive }).eq("id", taskId);

  revalidatePath("/manage");
  revalidatePath("/");
}
