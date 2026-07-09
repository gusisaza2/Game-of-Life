// Good Day → Chapter-up gate — CLAUDE.md "Core formulas" #7 (revised this
// session: XP threshold dropped, gate is now Good-Day-only; XP instead
// drives the Nivel system, see nivel.ts). Tutorial is retired — players
// start at Chapter 1, so gates only span 1→2 and 2→3 (Chapter 4 is out of
// MVP scope).

export type LevelGate = {
  fromLevel: number;
  toLevel: number;
  goodDayThreshold: number;
  rollingWindowDays: number;
  rateFloor: number;
};

export const LEVEL_GATES: LevelGate[] = [
  {
    fromLevel: 1,
    toLevel: 2,
    goodDayThreshold: 10, // Chapter 1's own Good Day requirement (no Tutorial prefix anymore).
    rollingWindowDays: 14,
    rateFloor: 0.5,
  },
  {
    fromLevel: 2,
    toLevel: 3,
    goodDayThreshold: 25, // 10 (Chapter 1) + 15 (Chapter 2).
    rollingWindowDays: 14,
    rateFloor: 0.5,
  },
];

export function getGateForLevel(level: number): LevelGate | undefined {
  return LEVEL_GATES.find((gate) => gate.fromLevel === level);
}
