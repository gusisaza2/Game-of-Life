"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Sets a task's priority stars (0 clears them). Never touches XP or dates.
export async function setTaskPriority(taskId: string, priority: number): Promise<boolean> {
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ priority }).eq("id", taskId).neq("tier", "habit");
  for (const path of ["/", "/missions", "/chores", "/manage"]) revalidatePath(path);
  return !error;
}
