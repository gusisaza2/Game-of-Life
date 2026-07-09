// Nested Nivel system — design doc Section 7.5 / CLAUDE.md Core formula #8.
// A finer-grained reward layer inside each Chapter, based on cumulative
// Good Days *within the current Chapter only* (resets when a new Chapter
// starts). Supersedes the never-built micro-milestone mechanic.

// Total Good Days required to complete each Chapter (the "G" in the
// formula) — CLAUDE.md Section 8 / design doc Section 7.5 example table.
// Only spans MVP scope (Tutorial + Chapters 1-3); undefined beyond that.
const CHAPTER_GOOD_DAY_TOTAL: Record<number, number> = {
  0: 7, // Tutorial
  1: 10,
  2: 15,
  3: 15,
};

// Cumulative lifetime Good Days already banked at the moment a Chapter is
// entered — i.e. the previous Chapter's exit threshold. Used to derive
// "Good Days within the current Chapter" from the lifetime total.
const CHAPTER_ENTRY_GD_THRESHOLD: Record<number, number> = {
  0: 0,
  1: 7,
  2: 17,
  3: 32,
};

export function nivelCountForChapter(goodDaysTotal: number): number {
  return Math.max(4, Math.round(Math.sqrt(goodDaysTotal) * 1.6));
}

// Cumulative Good-Days-within-chapter threshold for each Nivel, 1-indexed.
export function nivelThresholds(goodDaysTotal: number): number[] {
  const n = nivelCountForChapter(goodDaysTotal);
  const thresholds: number[] = [];
  for (let nivel = 1; nivel <= n; nivel++) {
    thresholds.push(Math.round(goodDaysTotal * (nivel / n) ** 1.4));
  }
  return thresholds;
}

export type NivelProgress = {
  currentNivel: number; // 0 if none reached yet this Chapter
  totalNiveles: number;
  goodDaysInChapter: number;
  goodDaysNeededForChapter: number;
};

// Returns null for a Chapter outside MVP scope (nothing to compute yet).
export function getNivelProgress(
  currentLevel: number,
  lifetimeGoodDayCount: number,
): NivelProgress | null {
  const goodDaysTotal = CHAPTER_GOOD_DAY_TOTAL[currentLevel];
  if (goodDaysTotal === undefined) return null;

  const entryThreshold = CHAPTER_ENTRY_GD_THRESHOLD[currentLevel] ?? 0;
  const goodDaysInChapter = Math.max(0, lifetimeGoodDayCount - entryThreshold);
  const thresholds = nivelThresholds(goodDaysTotal);
  const currentNivel = thresholds.filter((t) => goodDaysInChapter >= t).length;

  return {
    currentNivel,
    totalNiveles: thresholds.length,
    goodDaysInChapter,
    goodDaysNeededForChapter: goodDaysTotal,
  };
}
