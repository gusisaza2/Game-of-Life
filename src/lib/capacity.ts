// Capacity & decay — CLAUDE.md "Core formulas" #5-#6.

function smootherstep(t: number): number {
  return t ** 3 * (t * (6 * t - 15) + 10);
}

// Tutorial (level 0) shares Level 1's curve values — see leveling.ts for
// the same convention applied to area weights / daily XP cap.
function easeForLevel(level: number): number {
  const effectiveLevel = Math.max(level, 1);
  const t = (effectiveLevel - 1) / 14;
  return smootherstep(t);
}

export function capacityForLevel(level: number): number {
  return 10 + 90 * easeForLevel(level);
}

export const GRACE_DAYS = 3;
export const DECAY_RATE = 0.005;
export const TIER_CAP_LOSS = 0.18;

export function decayFloorForLevel(level: number): number {
  return capacityForLevel(level) * (1 - TIER_CAP_LOSS);
}

// Capacity is recomputed fresh from the level's baseline each time it's
// read — not compounded on the previously stored value — per CLAUDE.md's
// decay formula (see AreaCapacity in the data model).
export function computeDecayedCapacity(level: number, daysSinceActivity: number): number {
  const capacityAtLevel = capacityForLevel(level);
  if (daysSinceActivity <= GRACE_DAYS) return capacityAtLevel;

  const decayDays = daysSinceActivity - GRACE_DAYS;
  const floor = decayFloorForLevel(level);
  return Math.max(capacityAtLevel * (1 - DECAY_RATE) ** decayDays, floor);
}
