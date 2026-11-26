"use client";

import { useTransition } from "react";
import { rescheduleTasks } from "@/app/overdue/actions";

// Moves one task's deadline from its row. Only dates from today on are taken.
export function DueDateInput({ taskId, value, today }: { taskId: string; value: string | null; today: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-xs text-foreground/50">
      Due
      <input
        // Re-mounts when the saved date changes, so the field never goes stale.
        key={value ?? "none"}
        type="date"
        defaultValue={value ?? ""}
        min={today}
        disabled={isPending}
        onChange={(e) => {
          const dueDate = e.target.value;
          if (!dueDate || dueDate < today || dueDate === value) return;
          startTransition(async () => {
            await rescheduleTasks([{ id: taskId, dueDate }]);
          });
        }}
        className="rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-xs"
      />
    </label>
  );
}
