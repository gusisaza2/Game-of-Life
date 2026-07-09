import { getGateForLevel } from "@/lib/level-gates";

export type ProgressItem = { current: number; threshold: number };

export type LevelProgress = {
  goodDays: ProgressItem | null;
};

// Semi-visible progress toward the next Chapter (CLAUDE.md "Core formulas"
// #7, revised — Chapter is Good-Day-only now; XP progress lives in the
// Nivel bar instead, see nivel.ts).
export function getLevelProgress(currentLevel: number, lifetimeGoodDayCount: number): LevelProgress {
  const gate = getGateForLevel(currentLevel);
  if (!gate) return { goodDays: null };

  return {
    goodDays: { current: lifetimeGoodDayCount, threshold: gate.goodDayThreshold },
  };
}
