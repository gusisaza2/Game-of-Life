"use client";

import { useState, useTransition } from "react";
import { toggleTaskCompletion } from "@/app/actions";

type Task = {
  id: string;
  title: string;
};

type XpFlash = {
  xpAwarded: number;
  xpType: "growth" | "bonus";
  nivelUp: { nivelReached: number; totalNiveles: number } | null;
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
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<XpFlash | null>(null);

  function handleChange() {
    startTransition(async () => {
      const result = await toggleTaskCompletion(task.id, playerId, today, completed);
      if (result) {
        setFlash(result);
        setTimeout(() => setFlash(null), 2400);
      }
    });
  }

  return (
    <li className="flex flex-col gap-1">
      <label className="flex items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 cursor-pointer hover:bg-foreground/5">
        <input
          type="checkbox"
          checked={completed}
          disabled={isPending}
          onChange={handleChange}
          className="h-4 w-4"
        />
        <span className={completed ? "line-through text-foreground/40" : ""}>
          {task.title}
        </span>
        {flash && (
          <span className="ml-auto text-xs font-medium text-foreground/70">
            +{flash.xpAwarded} {flash.xpType === "bonus" ? "Bonus XP" : "XP"}
          </span>
        )}
      </label>
      {flash?.nivelUp && (
        <p className="px-4 text-xs font-medium text-foreground/70">
          ¡Nivel up! {flash.nivelUp.nivelReached} / {flash.nivelUp.totalNiveles}
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

  return (
    <section className="w-full max-w-md">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60 mb-2">
        {title}
      </h2>
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
