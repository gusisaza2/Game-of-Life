// Good Day → Level-up gate — CLAUDE.md "Core formulas" #7.
// MVP scope is Tutorial + Levels 1-3 only, so gates only go up to the 2→3
// boundary (per CLAUDE.md: Levels 4-15 explicitly out of scope for now).

export type LevelGate = {
  fromLevel: number;
  toLevel: number;
  xpThreshold: number | null;
  goodDayThreshold: number;
  rollingWindowDays: number;
  rateFloor: number;
};

export const LEVEL_GATES: LevelGate[] = [
  {
    fromLevel: 0, // Tutorial ("Awakening")
    toLevel: 1,
    xpThreshold: null, // Tutorial gates purely on Good Days, no XP requirement.
    goodDayThreshold: 7,
    rollingWindowDays: 14,
    rateFloor: 0.5,
  },
  {
    fromLevel: 1,
    toLevel: 2,
    xpThreshold: 450,
    goodDayThreshold: 17,
    rollingWindowDays: 14,
    rateFloor: 0.5,
  },
  {
    fromLevel: 2,
    toLevel: 3,
    xpThreshold: 1150,
    goodDayThreshold: 32,
    rollingWindowDays: 14,
    rateFloor: 0.5,
  },
];

export function getGateForLevel(level: number): LevelGate | undefined {
  return LEVEL_GATES.find((gate) => gate.fromLevel === level);
}
