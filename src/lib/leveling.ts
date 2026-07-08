// Level curve — CLAUDE.md "Core formulas" #3-#5. Implemented as the general
// smootherstep formula (not a lookup table) so Levels 4+ work later without
// rework, per CLAUDE.md's explicit instruction.

function smootherstep(t: number): number {
  return t ** 3 * (t * (6 * t - 15) + 10);
}

// Tutorial (level 0) has no defined weight/cap curve of its own — treat it
// like Level 1 for these purposes (it precedes Level 1 and shares its
// "struggling/rebuilding" accessibility constraint).
function easeForLevel(level: number): number {
  const effectiveLevel = Math.max(level, 1);
  const t = (effectiveLevel - 1) / 14;
  return smootherstep(t);
}

export function foundationWeight(level: number): number {
  const ease = easeForLevel(level);
  return 0.34 + (0.22 - 0.34) * ease;
}

export function otherAreaWeight(level: number): number {
  return (1 - 2 * foundationWeight(level)) / 3;
}

export function areaWeight(level: number, isFoundation: boolean): number {
  return isFoundation ? foundationWeight(level) : otherAreaWeight(level);
}

export function globalDailyXpCap(level: number): number {
  const ease = easeForLevel(level);
  return 41 + (84 - 41) * ease;
}

export function perAreaDailyXpCeiling(level: number, isFoundation: boolean): number {
  return globalDailyXpCap(level) * areaWeight(level, isFoundation);
}

export const TIER_XP_MULTIPLIER = {
  main_task: 4.0,
  habit: 2.5,
  chore: 1.0,
} as const;
