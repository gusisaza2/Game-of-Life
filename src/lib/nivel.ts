// Nested Nivel system — design doc Section 7.5, revised this session.
// A finer-grained reward layer inside each Chapter, now based on
// cumulative XP *within the current Chapter only* (resets when a new
// Chapter starts) rather than Good Days. This makes Nivel track the
// Effort axis and Chapter track the Balance axis (lifetime_good_day_count)
// as two independent motivators — CLAUDE.md/Section 2: "Effort without
// balance does not level the player. Balance without effort does not
// level the player."

// XP required to complete each Chapter (the "G" in the formula) — matches
// the already-locked XP-per-level table (design doc Section 7.3). No
// longer used for Chapter-gating (that's Good-Day-only now), only for
// pacing Nivel. Tutorial is retired; only spans MVP scope (Chapters 1-3).
const CHAPTER_XP_TOTAL: Record<number, number> = {
  1: 450,
  2: 700,
  3: 700,
};

// Cumulative lifetime XP already banked at the moment a Chapter is
// entered — i.e. the previous Chapter's exit threshold.
const CHAPTER_ENTRY_XP_THRESHOLD: Record<number, number> = {
  1: 0,
  2: 450,
  3: 1150,
};

// Calibrated so Chapter 1 (G=450) yields 5 Niveles — the same density the
// original Good-Day-based Nivel had for its first chapter. Chapters 2-3
// (G=700) yield 6. (The old coefficient, 1.6, was tuned for Good-Day-sized
// G values like 7-80; reused directly against XP-sized G values like
// 450-7,650 it would yield absurd results, e.g. 34 Niveles for Chapter 1.)
const NIVEL_COUNT_COEFFICIENT = 0.24;

export function nivelCountForChapter(xpTotal: number): number {
  return Math.max(4, Math.round(Math.sqrt(xpTotal) * NIVEL_COUNT_COEFFICIENT));
}

// Cumulative XP-within-chapter threshold for each Nivel, 1-indexed.
export function nivelThresholds(xpTotal: number): number[] {
  const n = nivelCountForChapter(xpTotal);
  const thresholds: number[] = [];
  for (let nivel = 1; nivel <= n; nivel++) {
    thresholds.push(Math.round(xpTotal * (nivel / n) ** 1.4));
  }
  return thresholds;
}

export type NivelProgress = {
  currentNivel: number; // 0 if none reached yet this Chapter
  totalNiveles: number;
  xpInChapter: number;
  xpNeededForChapter: number;
  // Cumulative XP-within-chapter needed for the *next* Nivel; null if
  // currentNivel is already the last one for this Chapter (the player is
  // just waiting on Good Days to advance the Chapter itself, not on more
  // XP for a Nivel).
  nextNivelThreshold: number | null;
};

// Returns null for a Chapter outside MVP scope (nothing to compute yet).
export function getNivelProgress(
  currentLevel: number,
  cumulativeXp: number,
): NivelProgress | null {
  const xpTotal = CHAPTER_XP_TOTAL[currentLevel];
  if (xpTotal === undefined) return null;

  const entryThreshold = CHAPTER_ENTRY_XP_THRESHOLD[currentLevel] ?? 0;
  const xpInChapter = Math.max(0, cumulativeXp - entryThreshold);
  const thresholds = nivelThresholds(xpTotal);
  const currentNivel = thresholds.filter((t) => xpInChapter >= t).length;
  const nextNivelThreshold = currentNivel < thresholds.length ? thresholds[currentNivel] : null;

  return {
    currentNivel,
    totalNiveles: thresholds.length,
    xpInChapter,
    xpNeededForChapter: xpTotal,
    nextNivelThreshold,
  };
}
