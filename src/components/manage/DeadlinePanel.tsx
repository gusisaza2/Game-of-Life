"use client";

import { useState, useTransition } from "react";
import { setTaskDueDate } from "@/app/manage/actions";
import { areaColor } from "@/lib/area-colors";
import { TIER_LABELS } from "@/lib/task-tiers";
import { Badge } from "@/components/Badge";
import { getTodayDateString } from "@/lib/today";

type UndatedTask = { id: string; title: string; tier: string; areaName: string | undefined };

function DeadlineRow({ task }: { task: UndatedTask }) {
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const color = areaColor(task.areaName);

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-foreground/20 bg-surface px-3 py-2.5 text-sm"
      style={{ borderLeft: `3px solid ${color.accent}` }}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        {task.title}
        <Badge>{TIER_LABELS[task.tier]}</Badge>
      </span>
      <form
        action={(formData) =>
          startTransition(async () => {
            await setTaskDueDate(formData);
          })
        }
        className="flex items-center gap-2"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <input
          type="date"
          name="dueDate"
          required
          min={getTodayDateString()}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="min-w-0 flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={isPending || !dueDate}
          className="btn-primary shrink-0 rounded px-3 py-1 text-sm disabled:opacity-60"
        >
          Set
        </button>
      </form>
    </li>
  );
}

// One-off tasks that predate deadlines (or were added without one). Each
// one drops out of this list the moment it gets a date.
export function DeadlinePanel({ tasks }: { tasks: UndatedTask[] }) {
  if (tasks.length === 0) return null;

  return (
    <section id="deadlines" className="w-full max-w-md flex flex-col gap-3 scroll-mt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">
          Needs a deadline <span className="text-foreground/40">({tasks.length})</span>
        </h2>
        <p className="text-xs text-foreground/50">
          Every Mission and Chore needs a date. Pick when each one has to be done by — be
          realistic, you can move it later.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <DeadlineRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  );
}
