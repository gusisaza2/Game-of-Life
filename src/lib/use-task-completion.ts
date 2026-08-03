"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { toggleTaskCompletion } from "@/app/actions";

export type XpFlash = {
  xpAwarded: number;
  xpType: "growth" | "bonus";
  nivelUp: { nivelReached: number; totalNiveles: number } | null;
  streakMilestone: { day: number; xpAwarded: number } | null;
};

// Shared completion + instant-feedback logic for anything that can toggle
// a Task's completion today (the plain checklist row, the Habit Streak
// card) -- same server action, same flash state shape, different layouts.
export function useTaskCompletion(
  taskId: string,
  playerId: string,
  today: string,
  completed: boolean,
) {
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<XpFlash | null>(null);
  // Flips the checkbox/ring the instant the user clicks, instead of waiting
  // for the server round trip + page revalidation. Reverts to the real
  // `completed` prop once the transition settles, so it silently agrees
  // with the server value once revalidatePath lands -- only the plain
  // done/not-done toggle is optimistic; XP/streak/Nivel amounts stay
  // server-authoritative (see `flash` below), since guessing those would
  // mean forking the ceiling/bonus/milestone math into the client.
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(completed);
  // `isPending` (React state) doesn't flip -- and so doesn't disable the
  // input -- until after a render commits, leaving a window where two
  // clicks landing back-to-back both fire before either sees it disabled.
  // Confirmed this by reproducing a duplicate task_logs row from a single
  // rapid double-click. A ref is set synchronously, before that render, so
  // the second call bails out immediately regardless of React's batching.
  const inFlightRef = useRef(false);

  function toggle() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    startTransition(async () => {
      setOptimisticCompleted(!completed);
      try {
        const result = await toggleTaskCompletion(taskId, playerId, today, completed);
        if (result) {
          setFlash(result);
          setTimeout(() => setFlash(null), 2400);
        }
      } finally {
        inFlightRef.current = false;
      }
    });
  }

  return { isPending, flash, toggle, completed: optimisticCompleted };
}
