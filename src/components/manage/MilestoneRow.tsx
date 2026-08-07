"use client";

import { useState } from "react";
import { TaskRow } from "./TaskRow";
import { MilestoneTaskForm } from "./MilestoneTaskForm";
import { Badge } from "@/components/Badge";

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
type Milestone = { id: string; order_index: number; title: string; status: string };

// Tasks are opt-in, not on-screen by default: adding one is a deliberate
// "+ Add task" click, and an existing list only shows once you ask to see
// it — the milestone line itself stays the default, uncluttered view.
export function MilestoneRow({
  milestone,
  taskRows,
  areas,
  canAddTask,
  playerId,
  defaultAreaId,
}: {
  milestone: Milestone;
  taskRows: { task: Task; milestoneOptions: MilestoneOption[] }[];
  areas: Area[];
  canAddTask: boolean;
  playerId: string;
  defaultAreaId: string;
}) {
  const [showTasks, setShowTasks] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="flex min-w-[120px] flex-1 items-center gap-2 text-sm text-foreground/80">
          <span
            aria-hidden
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={
              milestone.status === "completed"
                ? { backgroundColor: "var(--accent-primary)", color: "var(--on-accent-primary)" }
                : { border: "1.5px solid var(--foreground)", opacity: 0.3 }
            }
          >
            {milestone.status === "completed" ? "✓" : ""}
          </span>
          {milestone.title}
          {milestone.status === "completed" && <Badge tone="effort">Done</Badge>}
        </p>
        <div className="flex shrink-0 gap-3 text-xs">
          {taskRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTasks((v) => !v)}
              className="link-hover text-foreground/45"
            >
              {showTasks ? "Hide tasks" : `Tasks (${taskRows.length})`}
            </button>
          )}
          {canAddTask && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="link-hover text-foreground/45"
            >
              {showAddForm ? "Cancel" : "+ Add task"}
            </button>
          )}
        </div>
      </div>

      {showTasks && taskRows.length > 0 && (
        <ul className="flex flex-col gap-1 pl-3">
          {taskRows.map(({ task, milestoneOptions }) => (
            <TaskRow
              key={task.id}
              task={task}
              areas={areas}
              milestoneOptions={milestoneOptions}
              milestoneLabel={null}
              showTierBadge
            />
          ))}
        </ul>
      )}

      {showAddForm && (
        <div className="pl-3">
          <MilestoneTaskForm
            milestoneId={milestone.id}
            playerId={playerId}
            areas={areas}
            defaultAreaId={defaultAreaId}
          />
        </div>
      )}
    </li>
  );
}
