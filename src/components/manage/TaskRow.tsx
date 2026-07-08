"use client";

import { useState, useTransition } from "react";
import { updateTask, setTaskActive } from "@/app/manage/actions";

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
};

export function TaskRow({
  task,
  areas,
  milestoneOptions,
  milestoneLabel,
}: {
  task: Task;
  areas: Area[];
  milestoneOptions: MilestoneOption[];
  milestoneLabel: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tier, setTier] = useState(task.tier);
  const [isPending, startTransition] = useTransition();

  const areaName = areas.find((a) => a.id === task.area_id)?.name;

  if (!isEditing) {
    return (
      <li className="flex items-center justify-between rounded border border-foreground/10 px-3 py-2 text-sm">
        <span className={task.is_active ? "" : "text-foreground/40 line-through"}>
          {task.title}{" "}
          <span className="text-xs text-foreground/40">
            ({areaName}
            {milestoneLabel ? ` · ${milestoneLabel}` : ""})
          </span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-foreground/60 hover:text-foreground"
          >
            Edit
          </button>
          <form
            action={(formData) => startTransition(() => setTaskActive(formData))}
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="isActive" value={(!task.is_active).toString()} />
            <button disabled={isPending} className="text-xs text-foreground/60 hover:text-foreground">
              {task.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded border border-foreground/20 px-3 py-2">
      <form
        action={(formData) =>
          startTransition(async () => {
            await updateTask(formData);
            setIsEditing(false);
          })
        }
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="taskId" value={task.id} />

        <input
          name="title"
          defaultValue={task.title}
          required
          className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        />

        <div className="flex gap-2">
          <select
            name="tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          >
            <option value="habit">Habit</option>
            <option value="main_task">Main Task</option>
            <option value="chore">Chore</option>
          </select>

          <select
            name="areaId"
            defaultValue={task.area_id}
            required
            className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>

          <select
            name="recurrence"
            defaultValue={task.recurrence}
            className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {(tier === "main_task" || tier === "habit") && (
          <select
            name="milestoneId"
            defaultValue={task.milestone_id ?? ""}
            required={tier === "main_task"}
            className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          >
            <option value="">
              {tier === "main_task" ? "Link to a Milestone…" : "No linked Goal (standalone habit)"}
            </option>
            {milestoneOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-foreground/10 px-3 py-1 text-sm hover:bg-foreground/20"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setTier(task.tier);
              setIsEditing(false);
            }}
            className="rounded px-3 py-1 text-sm text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
