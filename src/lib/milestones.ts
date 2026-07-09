// Milestone names — design doc Section 7.1. Display-only; MVP scope only
// spans Stability (Chapters 1-3). Tutorial ("Awakening") is retired.
const MILESTONE_NAMES: Record<number, string> = {
  1: "Stability",
  2: "Stability",
  3: "Stability",
};

export function milestoneNameForLevel(level: number): string | null {
  return MILESTONE_NAMES[level] ?? null;
}
