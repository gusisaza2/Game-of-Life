import { getNivelProgress } from "@/lib/nivel";

export type NivelUpEvent = {
  nivelReached: number;
  totalNiveles: number;
};

export type NivelCheckResult = {
  lastNivelReached: number;
  event: NivelUpEvent | null;
};

// Pure decision: given the player's current Chapter state, detects whether
// a new Nivel threshold was just crossed. No I/O — see the note on
// computeLevelUp in level-up-service.ts for why (this always operates on
// in-memory state passed in by the Good Day backfill loop).
export function computeNivelUp(player: {
  current_level: number;
  lifetime_good_day_count: number;
  last_nivel_reached: number;
}): NivelCheckResult {
  const progress = getNivelProgress(player.current_level, player.lifetime_good_day_count);
  if (!progress || progress.currentNivel <= player.last_nivel_reached) {
    return { lastNivelReached: player.last_nivel_reached, event: null };
  }

  return {
    lastNivelReached: progress.currentNivel,
    event: { nivelReached: progress.currentNivel, totalNiveles: progress.totalNiveles },
  };
}
