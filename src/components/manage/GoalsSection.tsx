"use client";

import { useState, useTransition } from "react";
import { setGoalStatus, deleteGoal } from "@/app/manage/actions";
import { GoalWizard } from "@/components/manage/GoalWizard";
import { MilestoneForm } from "@/components/manage/MilestoneForm";
import { MilestoneRow } from "@/components/manage/MilestoneRow";
import { AreaIcon } from "@/components/AreaIcon";
import { Badge } from "@/components/Badge";
import { SectionHeading } from "@/components/SectionHeading";
import { areaColor } from "@/lib/area-colors";

type Area = { id: string; name: string };
type MilestoneOption = { id: string; label: string };
type Task = {
  id: string;
  title: string;
  tier: string;
  area_id: string;
  recurrence: string;
  is_active: boolean;
  milestone_id: string | null;
  scheduled_activation_date: string | null;
};
type Milestone = { id: string; title: string; order_index: number; status: string };
type Goal = { id: string; title: string; status: string; area_id: string; milestones: Milestone[] };

function GoalCard({
  goal,
  areaName,
  areas,
  editMode,
  playerId,
  taskRowsByMilestoneId,
}: {
  goal: Goal;
  areaName: string | undefined;
  areas: Area[];
  editMode: boolean;
  playerId: string;
  taskRowsByMilestoneId: Map<string, { task: Task; milestoneOptions: MilestoneOption[] }[]>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const color = areaColor(areaName);
  const totalMilestones = goal.milestones.length;
  const completedMilestones = goal.milestones.filter((m) => m.status === "completed").length;
  const milestonePct = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  function handleDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("goalId", goal.id);
      await deleteGoal(fd);
    });
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-foreground/20 bg-surface p-4 transition-colors hover:bg-surface-hover"
      style={{ borderLeft: `3px solid ${color.accent}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: color.soft, color: color.accent }}
          >
            <AreaIcon areaName={areaName} />
          </span>
          <div>
            <p className="font-medium">{goal.title}</p>
            <p className="text-xs text-foreground/60">{areaName}</p>
          </div>
          {goal.status === "completed" && <Badge tone="effort">Completed</Badge>}
          {goal.status === "abandoned" && <Badge tone="muted">Abandoned</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editMode ? (
            confirmingDelete ? (
              <>
                <span className="text-xs text-foreground/60">Delete everything?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs font-medium text-red-500 hover:text-red-400"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="link-hover text-xs text-foreground/60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-foreground/40 hover:text-red-500"
              >
                Delete
              </button>
            )
          ) : (
            goal.status === "active" && (
              <>
                <form action={setGoalStatus}>
                  <input type="hidden" name="goalId" value={goal.id} />
                  <input type="hidden" name="status" value="completed" />
                  <button className="link-hover text-xs text-foreground/60">Complete</button>
                </form>
                <form action={setGoalStatus}>
                  <input type="hidden" name="goalId" value={goal.id} />
                  <input type="hidden" name="status" value="abandoned" />
                  <button className="link-hover text-xs text-foreground/60">Abandon</button>
                </form>
              </>
            )
          )}
        </div>
      </div>

      {totalMilestones > 0 && (
        <div className="flex items-center gap-2 pl-11">
          <div className="h-1.5 flex-1 rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${milestonePct}%`, backgroundColor: color.accent }}
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-foreground/45">
            {completedMilestones}/{totalMilestones}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-3 pl-11">
        {[...goal.milestones]
          .sort((a, b) => a.order_index - b.order_index)
          .map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              taskRows={taskRowsByMilestoneId.get(milestone.id) ?? []}
              areas={areas}
              canAddTask={goal.status === "active" && milestone.status === "active"}
              playerId={playerId}
              defaultAreaId={goal.area_id}
            />
          ))}
      </ul>

      {goal.status === "active" && (
        <div className="pl-11">
          <MilestoneForm goalId={goal.id} />
        </div>
      )}
    </div>
  );
}

export function GoalsSection({
  goals,
  areas,
  playerId,
  tasksByMilestoneId,
  milestoneOptions,
  milestoneLabelsById,
}: {
  goals: Goal[];
  areas: Area[];
  playerId: string;
  tasksByMilestoneId: Map<string, Task[]>;
  milestoneOptions: MilestoneOption[];
  milestoneLabelsById: Map<string, string>;
}) {
  const [editMode, setEditMode] = useState(false);
  const areasById = new Map(areas.map((a) => [a.id, a.name]));

  // Guarantee a task's current milestone link survives into its edit
  // form's options, even if that Goal is no longer active.
  function milestoneOptionsFor(task: { milestone_id: string | null }) {
    if (!task.milestone_id || milestoneOptions.some((m) => m.id === task.milestone_id)) {
      return milestoneOptions;
    }
    return [
      ...milestoneOptions,
      {
        id: task.milestone_id,
        label: milestoneLabelsById.get(task.milestone_id) ?? "Linked milestone",
      },
    ];
  }

  return (
    <section className="w-full max-w-md flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <SectionHeading>Goals</SectionHeading>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className="link-hover text-xs text-foreground/45"
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {goals.map((goal) => {
        const taskRowsByMilestoneId = new Map(
          goal.milestones.map((m) => [
            m.id,
            (tasksByMilestoneId.get(m.id) ?? []).map((task) => ({
              task,
              milestoneOptions: milestoneOptionsFor(task),
            })),
          ]),
        );
        return (
          <GoalCard
            key={goal.id}
            goal={goal}
            areaName={areasById.get(goal.area_id)}
            areas={areas}
            editMode={editMode}
            playerId={playerId}
            taskRowsByMilestoneId={taskRowsByMilestoneId}
          />
        );
      })}

      <GoalWizard playerId={playerId} areas={areas} />
    </section>
  );
}
