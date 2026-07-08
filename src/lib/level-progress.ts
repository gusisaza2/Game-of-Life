import { getGateForLevel } from "@/lib/level-gates";

export type ProgressItem = { current: number; threshold: number };

export type LevelProgress = {
  xp: ProgressItem | null;
  goodDays: ProgressItem | null;
};

// Visible/semi-visible progress toward the next level (CLAUDE.md "Core
// formulas" #7 — XP is visible, Good Days are semi-visible; Capacity and
// the rolling-window rate stay backend-only per the UX principles).
export function getLevelProgress(
  currentLevel: number,
  cumulativeXp: number,
  lifetimeGoodDayCount: number,
): LevelProgress {
  const gate = getGateForLevel(currentLevel);
  if (!gate) return { xp: null, goodDays: null };

  return {
    xp:
      gate.xpThreshold === null
        ? null
        : { current: cumulativeXp, threshold: gate.xpThreshold },
    goodDays: { current: lifetimeGoodDayCount, threshold: gate.goodDayThreshold },
  };
}
