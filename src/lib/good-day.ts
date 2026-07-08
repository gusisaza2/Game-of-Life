// Good Day % — CLAUDE.md "Core formulas" #2.

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
