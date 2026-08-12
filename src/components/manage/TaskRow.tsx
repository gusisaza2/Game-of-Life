"use client";

import { useState, useTransition } from "react";
import { updateTask, setTaskActive, scheduleTaskActivation, deleteTask } from "@/app/manage/actions";
import { areaColor } from "@/lib/area-colors";
import { TIER_LABELS } from "@/lib/task-tiers";
import { Badge } from "@/components/Badge";
import { AreaIcon } from "@/components/AreaIcon";

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

export function TaskRow({
  task,
  areas,
  milestoneOptions,
  milestoneLabel,
  showTierBadge = false,
}: {
  task: Task;
  areas: Area[];
  milestoneOptions: MilestoneOption[];
  milestoneLabel: string | null;
  showTierBadge?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tier, setTier] = useState(task.tier);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const areaName = areas.find((a) => a.id === task.area_id)?.name;
  const color = areaColor(areaName);

  if (!isEditing) {
    const isScheduled = !task.is_active && !!task.scheduled_activation_date;

    return (
      <li
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-foreground/20 bg-surface px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover"
        style={{ borderLeft: `3px solid ${color.accent}` }}
      >
        <div className="flex min-w-[140px] flex-1 items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: color.soft, color: color.accent }}
          >
            <AreaIcon areaName={areaName} className="h-3.5 w-3.5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={`flex flex-wrap items-center gap-1.5 ${task.is_active ? "" : "text-foreground/50"}`}
            >
              {task.title}
              {showTierBadge && <Badge>{TIER_LABELS[task.tier]}</Badge>}
              {/* Not struck through — inactive just means "planned for later,"
                  not "done" or "cancelled," and strikethrough reads as the latter. */}
              {!task.is_active && !isScheduled && <Badge tone="muted">Planned</Badge>}
              {isScheduled && <Badge tone="effort">Activates tomorrow</Badge>}
            </span>
            <span className="text-xs text-foreground/40">
              {areaName}
              {milestoneLabel ? ` · ${milestoneLabel}` : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {confirmingDelete ? (
            <>
              <span className="text-xs text-foreground/60">Delete?</span>
              <form action={(formData) => startTransition(() => deleteTask(formData))}>
                <input type="hidden" name="taskId" value={task.id} />
                <button disabled={isPending} className="text-xs font-medium text-red-500 hover:text-red-400">
                  Confirm
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="link-hover text-xs text-foreground/60"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-foreground/40 hover:text-red-500"
              >
                Delete
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="link-hover text-xs text-foreground/60"
              >
                Edit
              </button>
              {!task.is_active && (
                <form
                  action={(formData) => startTransition(() => scheduleTaskActivation(formData))}
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="scheduled" value={(!isScheduled).toString()} />
                  <button disabled={isPending} className="link-hover text-xs text-foreground/60">
                    {isScheduled ? "Cancel schedule" : "Activate tomorrow"}
                  </button>
                </form>
              )}
              <form action={(formData) => startTransition(() => setTaskActive(formData))}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="isActive" value={(!task.is_active).toString()} />
                <button disabled={isPending} className="link-hover text-xs text-foreground/60">
                  {task.is_active ? "Deactivate" : "Activate now"}
                </button>
              </form>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex flex-col gap-2 rounded border border-foreground/20 bg-surface px-3 py-2"
      style={{ borderLeft: `3px solid ${color.accent}` }}
    >
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
            <option value="habit">{TIER_LABELS.habit}</option>
            <option value="main_task">{TIER_LABELS.main_task}</option>
            <option value="chore">{TIER_LABELS.chore}</option>
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
          <button type="submit" disabled={isPending} className="btn-primary rounded px-3 py-1 text-sm">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setTier(task.tier);
              setIsEditing(false);
            }}
            className="link-hover rounded px-3 py-1 text-sm text-foreground/60"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
