// Habit Streak — per-Habit consecutive-day tracking, independent of Good
// Days/Chapter/Tasks. The ring itself visually caps at STREAK_GOAL_DAYS
// (21), but the streak (and its XP milestones) keep going beyond that for
// as long as the player keeps it up.
//
// Milestone XP = multiplier * that habit's area daily XP ceiling at the
// player's current level (per_area_ceiling), so the reward automatically
// scales with Chapter/level the same way everything else does, without a
// second formula. First four thresholds are fixed; beyond day 21 both the
// day-gap and the multiplier grow ×1.2 each step (design discussion:
// tried ×1.5 first, it blew past a full Chapter's XP budget too easily;
// ×1.2 stays under a Chapter's total even on very long streaks).
export const STREAK_GOAL_DAYS = 21;

export type StreakMilestone = { day: number; multiplier: number };

const FIXED_MILESTONES: StreakMilestone[] = [
  { day: 5, multiplier: 1 },
  { day: 10, multiplier: 2 },
  { day: 15, multiplier: 3.5 },
  { day: 21, multiplier: 5 },
];

const GROWTH_RATE = 1.2;
const BASE_GAP_DAYS = 9;
// Generated once, far enough out to cover decades of an unbroken streak.
const GENERATED_COUNT = 30;

function buildMilestones(): StreakMilestone[] {
  const milestones = [...FIXED_MILESTONES];
  let day = 21;
  let multiplier = 5;
  let gap = BASE_GAP_DAYS;
  for (let i = 0; i < GENERATED_COUNT; i++) {
    day += Math.round(gap);
    multiplier = Math.round(multiplier * GROWTH_RATE * 100) / 100;
    gap *= GROWTH_RATE;
    milestones.push({ day, multiplier });
  }
  return milestones;
}

const STREAK_MILESTONES = buildMilestones();

// A streak only ever advances one day at a time, so it always lands
// exactly on a milestone's day if it reaches one — no range-scanning
// needed, just an exact match.
export function streakMilestoneAt(streakDay: number): StreakMilestone | null {
  return STREAK_MILESTONES.find((m) => m.day === streakDay) ?? null;
}

export function nextStreakMilestoneAfter(streakDay: number): StreakMilestone {
  return (
    STREAK_MILESTONES.find((m) => m.day > streakDay) ??
    STREAK_MILESTONES[STREAK_MILESTONES.length - 1]
  );
}

// Rounded to a whole number (unlike other XP sources in the game, which
// can be fractional) -- streak milestone payouts read as a clean, gameified
// number rather than a decimal.
export function xpForStreakMilestone(multiplier: number, areaDailyCeiling: number): number {
  return Math.round(multiplier * areaDailyCeiling);
}
