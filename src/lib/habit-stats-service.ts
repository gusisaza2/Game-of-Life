import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";

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

// Every completion date per task, all time -- the Habit Stats page does
// the per-month slicing itself so browsing back through past months
// needs no further round trips. Paginated (see fetch-all.ts) so the
// history can't silently truncate at 1000 rows.
export async function getAllCompletedDatesByTask(
  playerId: string,
  taskIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;

  const supabase = await createClient();
  const rows = await fetchAllRows<{ task_id: string; completed_date: string }>((from, to) =>
    supabase
      .from("task_logs")
      .select("task_id, completed_date")
      .eq("player_id", playerId)
      .in("task_id", taskIds)
      .order("completed_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  for (const row of rows) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.completed_date);
    map.set(row.task_id, list);
  }
  return map;
}
