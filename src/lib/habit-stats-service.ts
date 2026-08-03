import { createClient } from "@/lib/supabase/server";

// Batched (not per-habit) so the Today page and the Habit Stats page can
// both fetch what they need in one query regardless of habit count.
export async function getMonthlyCompletedDatesByTask(
  playerId: string,
  taskIds: string[],
  monthStart: string,
  today: string,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_logs")
    .select("task_id, completed_date")
    .eq("player_id", playerId)
    .in("task_id", taskIds)
    .gte("completed_date", monthStart)
    .lte("completed_date", today);

  for (const row of data ?? []) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.completed_date);
    map.set(row.task_id, list);
  }
  return map;
}

export async function getLifetimeCompletionCounts(
  playerId: string,
  taskIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (taskIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_logs")
    .select("task_id")
    .eq("player_id", playerId)
    .in("task_id", taskIds);

  for (const row of data ?? []) {
    map.set(row.task_id, (map.get(row.task_id) ?? 0) + 1);
  }
  return map;
}
