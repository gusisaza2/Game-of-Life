"use client";

import { useTransition } from "react";
import { toggleTaskCompletion } from "@/app/actions";

type Task = {
  id: string;
  title: string;
};

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
  const [isPending, startTransition] = useTransition();

  if (tasks.length === 0) return null;

  return (
    <section className="w-full max-w-md">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60 mb-2">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          const completed = completedIds.has(task.id);
          return (
            <li key={task.id}>
              <label className="flex items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 cursor-pointer hover:bg-foreground/5">
                <input
                  type="checkbox"
                  checked={completed}
                  disabled={isPending}
                  onChange={() =>
                    startTransition(() =>
                      toggleTaskCompletion(task.id, playerId, today, completed),
                    )
                  }
                  className="h-4 w-4"
                />
                <span className={completed ? "line-through text-foreground/40" : ""}>
                  {task.title}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
