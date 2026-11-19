"use client";

import { useState } from "react";

// Things the player just finished stay where they are for a moment (so the
// "+4 XP" feedback is still on screen) before moving into the "Completed"
// folder. `mark(id)` starts that moment; `recent` holds the ids still in it.
export function useRecentlyDone(holdMs = 5000) {
  const [recent, setRecent] = useState<Set<string>>(new Set());

  function mark(id: string) {
    setRecent((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setRecent((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, holdMs);
  }

  return { recent, mark };
}
