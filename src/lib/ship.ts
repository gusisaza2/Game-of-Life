import { getNivelProgress } from "@/lib/nivel";

// Ship construction progress — design doc Section 10.6. MVP only covers
// Milestone I ("Stability", Chapters 1-3): from the empty dock through
// "hull takes shape, keel + ribs visible, not yet closed" — the milestone
// ends there, planking is Milestone II (out of scope, Chapters 4+).
//
// Reuses the existing Nivel system as the progress signal (no new DB
// fields): position = how many Niveles have been reached across the whole
// milestone, out of the milestone's total. This is deliberately the same
// XP-driven, real-time signal Nivel already is — the Ship updates the
// moment a task is completed, same as the Nivel bar.
const CHAPTER_NIVEL_COUNTS: Record<number, number> = { 1: 5, 2: 6, 3: 6 };
const CHAPTER_ORDER = [1, 2, 3];
const TOTAL_NIVELES_IN_MILESTONE = Object.values(CHAPTER_NIVEL_COUNTS).reduce(
  (sum, n) => sum + n,
  0,
);

const RIB_COUNT = 10;

export type ShipStage = {
  progress: number; // 0-1 across the whole of Milestone I
  ribsVisible: number; // 0-RIB_COUNT
  ribCount: number;
};

export function getShipStage(currentLevel: number, cumulativeXp: number): ShipStage {
  const nivel = getNivelProgress(currentLevel, cumulativeXp);
  const nivelesInThisChapter = nivel?.currentNivel ?? 0;

  const chapterIndex = CHAPTER_ORDER.indexOf(currentLevel);
  const completedChapterNiveles =
    chapterIndex === -1
      ? TOTAL_NIVELES_IN_MILESTONE // Beyond MVP scope (Chapter 4+) — show the hull fully ribbed.
      : CHAPTER_ORDER.slice(0, chapterIndex).reduce(
          (sum, level) => sum + (CHAPTER_NIVEL_COUNTS[level] ?? 0),
          0,
        );

  const progress = Math.min(
    1,
    (completedChapterNiveles + nivelesInThisChapter) / TOTAL_NIVELES_IN_MILESTONE,
  );

  return {
    progress,
    ribsVisible: Math.round(progress * RIB_COUNT),
    ribCount: RIB_COUNT,
  };
}
