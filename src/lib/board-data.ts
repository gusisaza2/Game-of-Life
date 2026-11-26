import { createClient } from "@/lib/supabase/server";
import { chooseTodayChores } from "@/lib/chores";
import { todayPlacement } from "@/lib/deadline";
import type { BoardTask } from "@/lib/mission-groups";
import { fetchAllRows } from "@/lib/fetch-all";
import { getTodayDateString } from "@/lib/today";

type TaskRow = {
  id: string;
  title: string;
  tier: string;
  area_id: string;
  milestone_id: string | null;
  due_date: string | null;
  done_date: string | null;
  today_pick: string | null;
  priority: number;
};

// Everything the Missions page or the chores page lists: every active task of
// that kind (open, later and finished), placed in its Goal and Milestone.
export async function loadBoard(tier: "main_task" | "chore") {
  const supabase = await createClient();
  const today = getTodayDateString();
  const { data: player } = await supabase.from("players").select("id").single();
  if (!player) return null;

  const [tasks, { data: logs }, { data: areas }, { data: milestones }, { data: goals }, { data: blocks }] =
    await Promise.all([
      fetchAllRows<TaskRow>((from, to) =>
        supabase
          .from("tasks")
          .select("id, title, tier, area_id, milestone_id, due_date, done_date, today_pick, priority")
          .eq("player_id", player.id)
          .eq("tier", tier)
          .eq("is_active", true)
          .order("title")
          .order("id")
          .range(from, to),
      ),
      supabase.from("task_logs").select("task_id").eq("player_id", player.id).eq("completed_date", today),
      supabase.from("areas").select("id, name"),
      supabase.from("milestones").select("id, title, goal_id, order_index"),
      supabase.from("goals").select("id, title, area_id"),
      supabase
        .from("time_blocks")
        .select("task_id, block_date, status, resolved_on")
        .eq("player_id", player.id)
        .or(`status.eq.planned,resolved_on.eq.${today}`),
    ]);

  const areaName = new Map((areas ?? []).map((a) => [a.id, a.name as string]));
  const milestoneById = new Map((milestones ?? []).map((m) => [m.id, m]));
  const goalById = new Map((goals ?? []).map((g) => [g.id, g]));

  const completedIds = new Set<string>((logs ?? []).map((l) => l.task_id));
  const lockedIds = new Set<string>();
  for (const t of tasks) {
    if (!t.done_date) continue;
    completedIds.add(t.id);
    if (t.done_date < today) lockedIds.add(t.id);
  }

  const boardTasks: BoardTask[] = tasks.map((t) => {
    const milestone = t.milestone_id ? milestoneById.get(t.milestone_id) : undefined;
    const goal = milestone ? goalById.get(milestone.goal_id) : undefined;
    return {
      id: t.id,
      title: t.title,
      areaName: areaName.get(t.area_id),
      due_date: t.due_date,
      priority: t.priority,
      goalId: goal?.id ?? "none",
      goalTitle: goal?.title ?? "Other Missions",
      goalAreaName: goal ? areaName.get(goal.area_id) : undefined,
      milestoneId: milestone?.id ?? "none",
      milestoneTitle: milestone?.title ?? "No milestone",
      milestoneOrder: milestone?.order_index ?? 9999,
    };
  });

  // Which open chores hold Today's slots -- the same rule Today applies.
  const blockedToday = new Set(
    (blocks ?? [])
      .filter(
        (b) => (b.status === "planned" && b.block_date <= today) || (b.status === "done" && b.resolved_on === today),
      )
      .map((b) => b.task_id),
  );
  const slotIds = new Set(
    tier === "chore"
      ? chooseTodayChores(
          tasks
            .filter((t) => !completedIds.has(t.id))
            .map((t) => ({
              id: t.id,
              title: t.title,
              due_date: t.due_date,
              priority: t.priority,
              today_pick: t.today_pick,
              hasBlockToday: blockedToday.has(t.id),
              due: todayPlacement(t, today) === "shown",
            })),
        )
      : [],
  );
  const activeChores = boardTasks.filter((t) => slotIds.has(t.id)).map((t) => ({ id: t.id, title: t.title }));

  return { playerId: player.id as string, today, tasks: boardTasks, completedIds, lockedIds, activeChores };
}
