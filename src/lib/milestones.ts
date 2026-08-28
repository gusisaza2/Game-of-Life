// Milestone names — design doc Section 7.1, all 5 already locked there.
// MVP mechanics only span Stability (Chapters 1-3) so far, but the names
// themselves are pure display content -- safe to show ahead of a
// Chapter's mechanics actually being built (e.g. on the Voyage Map,
// which shows all 15 Chapters at once). Tutorial ("Awakening") is retired.
const MILESTONE_NAMES: Record<number, string> = {
  1: "Stability",
  2: "Stability",
  3: "Stability",
  4: "Momentum",
  5: "Momentum",
  6: "Momentum",
  7: "Growth",
  8: "Growth",
  9: "Growth",
  10: "Balance",
  11: "Balance",
  12: "Balance",
  13: "Healthy Life",
  14: "Healthy Life",
  15: "Healthy Life",
};

export function milestoneNameForLevel(level: number): string | null {
  return MILESTONE_NAMES[level] ?? null;
}
