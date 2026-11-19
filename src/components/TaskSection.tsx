"use client";

import { areaColor } from "@/lib/area-colors";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { SectionHeading } from "@/components/SectionHeading";
import { Badge } from "@/components/Badge";
import { compareByDeadline, deadlineLabel, deadlineStatus } from "@/lib/deadline";
import { useRecentlyDone } from "@/lib/use-recently-done";

export type Task = {
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

export function TaskItem({
  task,
  completed,
  playerId,
  today,
  onCompleted,
}: {
  task: Task;
  completed: boolean;
  playerId: string;
  today: string;
  // Called when the player checks the task off (not when they undo it).
  onCompleted?: (id: string) => void;
}) {
  const {
    isPending,
    flash,
    toggle,
    completed: displayCompleted,
  } = useTaskCompletion(task.id, playerId, today, completed);
  const color = areaColor(task.areaName);

  return (
    <li id={`task-${task.id}`} className="flex flex-col gap-1 scroll-mt-4">
      <label
        className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-foreground/20 bg-surface pl-3 pr-4 py-3 cursor-pointer transition-colors hover:bg-surface-hover"
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
          onChange={() => {
            if (!displayCompleted) onCompleted?.(task.id);
            toggle();
          }}
          className="h-4 w-4 shrink-0"
          style={{ accentColor: color.accent }}
        />
        <span className="flex min-w-[8rem] flex-1 flex-col">
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

// A list of tasks with what's done tucked away: open ones on top (soonest
// deadline first), finished ones in a collapsed "Completed (N)" folder below.
// A task checked off just now stays in place for a moment so its XP feedback
// is seen, then moves into the folder.
export function TaskList({
  tasks,
  completedIds,
  playerId,
  today,
}: {
  tasks: Task[];
  completedIds: Set<string>;
  playerId: string;
  today: string;
}) {
  const { recent, mark } = useRecentlyDone();
  const byDeadline = (a: Task, b: Task) =>
    compareByDeadline({ ...a, due_date: a.due_date ?? null }, { ...b, due_date: b.due_date ?? null });
  const isDone = (t: Task) => completedIds.has(t.id) && !recent.has(t.id);
  const open = tasks.filter((t) => !isDone(t)).sort(byDeadline);
  const done = tasks.filter(isDone).sort(byDeadline);

  const row = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      completed={completedIds.has(task.id)}
      playerId={playerId}
      today={today}
      onCompleted={mark}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      {open.length > 0 && <ul className="flex flex-col gap-2">{open.map(row)}</ul>}
      {done.length > 0 && (
        <details className="group/done">
          <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 py-1 text-xs text-foreground/45 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-[10px] transition-transform group-open/done:rotate-90">
              ▸
            </span>
            Completed <span className="tabular-nums text-foreground/35">({done.length})</span>
          </summary>
          <ul className="flex flex-col gap-2 pt-1">{done.map(row)}</ul>
        </details>
      )}
    </div>
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
      <TaskList tasks={tasks} completedIds={completedIds} playerId={playerId} today={today} />
    </section>
  );
}
