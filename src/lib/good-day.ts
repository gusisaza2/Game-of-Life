// Good Day % — CLAUDE.md "Core formulas" #2.
import { CHORES_ON_TODAY } from "@/lib/chores";

export const GOOD_DAY_THRESHOLD = 0.8;

export const CATEGORY_WEIGHTS = {
  habit: 0.4,
  main_task: 0.4,
  chore: 0.2,
} as const;

// A category with zero items due that day counts as fully satisfied —
// don't penalize for a category with nothing scheduled.
export function calculateCategoryPct(dueCount: number, completedCount: number): number {
  if (dueCount === 0) return 1.0;
  return completedCount / dueCount;
}

// Chores are capped: Today shows at most CHORES_ON_TODAY, so the day never
// asks for more than that. Doing that many (or every one due, if fewer) is
// 100%. Any chore finished that day counts, including one the player swapped
// onto Today before it was due.
export function calculateChorePct(dueCount: number, completedCount: number): number {
  if (dueCount === 0) return 1.0;
  const asked = Math.min(dueCount, CHORES_ON_TODAY);
  return Math.min(completedCount, asked) / asked;
}

export function calculateGoodDayPct(
  habitPct: number,
  mainTaskPct: number,
  chorePct: number,
): number {
  return (
    habitPct * CATEGORY_WEIGHTS.habit +
    mainTaskPct * CATEGORY_WEIGHTS.main_task +
    chorePct * CATEGORY_WEIGHTS.chore
  );
}

export function isGoodDay(goodDayPct: number): boolean {
  return goodDayPct >= GOOD_DAY_THRESHOLD;
}
