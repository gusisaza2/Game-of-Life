"use client";

import { areaColor } from "@/lib/area-colors";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { SectionHeading } from "@/components/SectionHeading";
import { Badge } from "@/components/Badge";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";

type Task = {
  id: string;
  title: string;
  areaName?: string;
  due_date?: string | null;
  // The event this task prepares for, when it has one.
  eventTitle?: string;
};

// Escalates with the clock: quiet until the window opens, stronger the day
// before, strongest once it's overdue -- but always a label, never a popup.
function DeadlineChip({ dueDate, today }: { dueDate: string; today: string }) {
  const { kind } = deadlineStatus(dueDate, today);
  const tone = kind === "soon" ? "neutral" : "effort";
  return (
    <span className="ml-auto shrink-0">
      <Badge tone={tone}>{deadlineLabel(dueDate, today)}</Badge>
    </span>
  );
}

function TaskItem({
  task,
  completed,
  playerId,
  today,
}: {
  task: Task;
  completed: boolean;
  playerId: string;
  today: string;
}) {
  const {
    isPending,
    flash,
    toggle,
    completed: displayCompleted,
  } = useTaskCompletion(task.id, playerId, today, completed);
  const color = areaColor(task.areaName);

  return (
    <li className="flex flex-col gap-1">
      <label
        className="group flex items-center gap-3 rounded-xl border border-foreground/20 bg-surface pl-3 pr-4 py-3 cursor-pointer transition-colors hover:bg-surface-hover"
        style={{ borderLeft: `3px solid ${color.accent}` }}
      >
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color.accent }}
        />
        <input
          type="checkbox"
          checked={displayCompleted}
          disabled={isPending}
          onChange={toggle}
          className="h-4 w-4 shrink-0"
          style={{ accentColor: color.accent }}
        />
        <span className="flex min-w-0 flex-col">
          <span
            className={displayCompleted ? "line-through text-foreground/35" : "text-foreground/90"}
          >
            {task.title}
          </span>
          {task.eventTitle && (
            <span className="text-xs text-foreground/40">for: {task.eventTitle}</span>
          )}
        </span>
        {task.due_date && !displayCompleted && (
          <DeadlineChip dueDate={task.due_date} today={today} />
        )}
        {flash && (
          <span
            key={flash.xpAwarded + flash.xpType}
            className="xp-flash ml-auto shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: flash.xpType === "bonus" ? "var(--accent-effort)" : color.accent }}
          >
            +{flash.xpAwarded} {flash.xpType === "bonus" ? "Bonus XP" : "XP"}
          </span>
        )}
      </label>
      {flash?.nivelUp && (
        <p className="xp-flash px-4 text-xs font-medium" style={{ color: "var(--accent-effort)" }}>
          ¡Nivel up! {flash.nivelUp.nivelReached} / {flash.nivelUp.totalNiveles}
        </p>
      )}
      {flash?.streakMilestone && (
        <p className="xp-flash px-4 text-xs font-medium" style={{ color: color.accent }}>
          🔥 {flash.streakMilestone.day}-day streak! +{flash.streakMilestone.xpAwarded} XP
        </p>
      )}
    </li>
  );
}

export function TaskSection({
  title,
  tasks,
  completedIds,
  playerId,
  today,
}: {
  title: string;
  tasks: Task[];
  completedIds: Set<string>;
  playerId: string;
  today: string;
}) {
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => completedIds.has(t.id)).length;

  return (
    <section className="w-full max-w-md">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
          {title}
        </SectionHeading>
        <span className="text-xs tabular-nums text-foreground/35">
          {doneCount}/{tasks.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            completed={completedIds.has(task.id)}
            playerId={playerId}
            today={today}
          />
        ))}
      </ul>
    </section>
  );
}
