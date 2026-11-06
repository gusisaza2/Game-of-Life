import { areaColor } from "@/lib/area-colors";
import { deadlineLabel } from "@/lib/deadline";

type BacklogTask = { id: string; title: string; due_date: string | null; areaName?: string };

function formatDueDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Dated tasks that aren't due soon. Collapsed by default so a long backlog
// doesn't crowd Today; each one moves up on its own when its window opens.
export function BacklogList({ tasks, today }: { tasks: BacklogTask[]; today: string }) {
  if (tasks.length === 0) return null;

  return (
    <details className="w-full max-w-md rounded-xl border border-foreground/20 bg-surface">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm text-foreground/70">
        Backlog <span className="text-foreground/40">({tasks.length})</span>
      </summary>
      <ul className="flex flex-col gap-1.5 px-4 pb-3">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: areaColor(task.areaName).accent }}
              />
              <span className="min-w-0 text-foreground/80">{task.title}</span>
            </span>
            {task.due_date && (
              <span
                className="shrink-0 text-xs tabular-nums text-foreground/45"
                title={deadlineLabel(task.due_date, today)}
              >
                {formatDueDate(task.due_date)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
