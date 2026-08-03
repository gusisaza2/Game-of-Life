"use client";

import { areaColor } from "@/lib/area-colors";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { SectionHeading } from "@/components/SectionHeading";

type Task = {
  id: string;
  title: string;
  areaName?: string;
};

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
  const { isPending, flash, toggle } = useTaskCompletion(task.id, playerId, today, completed);
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
          checked={completed}
          disabled={isPending}
          onChange={toggle}
          className="h-4 w-4 shrink-0"
          style={{ accentColor: color.accent }}
        />
        <span className={completed ? "line-through text-foreground/35" : "text-foreground/90"}>
          {task.title}
        </span>
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
