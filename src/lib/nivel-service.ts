import { getNivelProgress } from "@/lib/nivel";

export type NivelUpEvent = {
  nivelReached: number;
  totalNiveles: number;
};

export type NivelCheckResult = {
  lastNivelReached: number;
  event: NivelUpEvent | null;
};

// Pure decision: given the player's current Chapter/XP state, detects
// whether a new Nivel threshold was just crossed. No I/O — XP (unlike
// Good Days) is awarded immediately on task completion, so this is called
// synchronously right after cumulative_xp changes (src/app/actions.ts),
// not from the Good Day backfill loop.
export function computeNivelUp(player: {
  current_level: number;
  cumulative_xp: number;
  last_nivel_reached: number;
}): NivelCheckResult {
  const progress = getNivelProgress(player.current_level, player.cumulative_xp);
  if (!progress || progress.currentNivel <= player.last_nivel_reached) {
    return { lastNivelReached: player.last_nivel_reached, event: null };
  }

  return {
    lastNivelReached: progress.currentNivel,
    event: { nivelReached: progress.currentNivel, totalNiveles: progress.totalNiveles },
  };
}
