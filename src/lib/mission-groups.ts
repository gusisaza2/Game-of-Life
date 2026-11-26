import type { Task } from "@/components/TaskSection";
import type { MissionGroup } from "@/components/MissionGroups";

// A task with what's needed to place it in the Goal -> Milestone structure
// (chores have no Goal and leave those empty).
export type BoardTask = Task & {
  goalId: string;
  goalTitle: string;
  goalAreaName?: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
};

// Groups Missions by Goal, then by Milestone in the Milestone's own order. The
// Goal with the most urgent open Mission comes first.
export function buildMissionGroups(tasks: BoardTask[], completedIds: Set<string>): MissionGroup[] {
  const byGoal = new Map<string, BoardTask[]>();
  for (const task of tasks) byGoal.set(task.goalId, [...(byGoal.get(task.goalId) ?? []), task]);

  const earliestOpenDue = (list: BoardTask[]) =>
    list
      .filter((t) => !completedIds.has(t.id) && t.due_date)
      .map((t) => t.due_date as string)
      .sort()[0] ?? "9999-12-31";

  return [...byGoal.entries()]
    .sort(
      ([, a], [, b]) =>
        earliestOpenDue(a).localeCompare(earliestOpenDue(b)) || a[0].goalTitle.localeCompare(b[0].goalTitle),
    )
    .map(([goalId, goalTasks]) => {
      const byMilestone = new Map<string, BoardTask[]>();
      for (const task of goalTasks) {
        byMilestone.set(task.milestoneId, [...(byMilestone.get(task.milestoneId) ?? []), task]);
      }
      return {
        goalId,
        title: goalTasks[0].goalTitle,
        areaName: goalTasks[0].goalAreaName,
        milestones: [...byMilestone.entries()]
          .sort(([, a], [, b]) => a[0].milestoneOrder - b[0].milestoneOrder)
          .map(([id, list]) => ({ id, title: list[0].milestoneTitle, tasks: list })),
      };
    });
}
