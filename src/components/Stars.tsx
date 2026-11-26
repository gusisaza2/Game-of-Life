"use client";

import { useOptimistic, useTransition } from "react";
import { setTaskPriority } from "@/app/missions/actions";

const STAR_COLOR = "var(--accent-effort)";

// Read-only stars next to a task's name. Nothing is shown for no stars.
export function Stars({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="shrink-0 text-xs tracking-tight" style={{ color: STAR_COLOR }} aria-label={`Priority ${value} of 3`}>
      {"★".repeat(value)}
    </span>
  );
}

// Tap a star to set that many; tap the current one again to clear.
export function StarPicker({ taskId, value }: { taskId: string; value: number }) {
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(value);

  return (
    <span className="flex items-center" role="group" aria-label="Priority">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          disabled={isPending}
          aria-label={shown === n ? "Clear priority" : `Set priority ${n} of 3`}
          aria-pressed={shown >= n}
          onClick={() => {
            const next = shown === n ? 0 : n;
            startTransition(async () => {
              setShown(next);
              await setTaskPriority(taskId, next);
            });
          }}
          className="px-1.5 py-0.5 text-lg leading-none transition-opacity disabled:opacity-60"
          style={{ color: shown >= n ? STAR_COLOR : "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
        >
          {shown >= n ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}
