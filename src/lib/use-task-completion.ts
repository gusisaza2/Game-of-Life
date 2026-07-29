"use client";

import { useState, useTransition } from "react";
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

  function toggle() {
    startTransition(async () => {
      const result = await toggleTaskCompletion(taskId, playerId, today, completed);
      if (result) {
        setFlash(result);
        setTimeout(() => setFlash(null), 2400);
      }
    });
  }

  return { isPending, flash, toggle };
}
