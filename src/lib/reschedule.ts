import { shiftDate } from "@/lib/deadline";
import {
  HEAVY_DAY_MINUTES,
  durationMinutes,
  firstFreeStart,
  fromMinutes,
  toMinutes,
  type Slot,
} from "@/lib/time-blocks";

// "Something came up": finds a new place for the work blocks a surprise
// pushed out of their slots. It only ever PROPOSES -- the player reviews the
// plan and confirms; nothing moves on its own. Events are never moved here
// (they're fixed by someone else), they just count as busy time.

export type MovableBlock = { id: string; title: string; date: string; start: string; end: string };
export type Placement = { date: string; start: string; end: string };
export type ProposedMove = {
  id: string;
  title: string;
  from: Placement;
  // null when there's no room in the horizon -- the player decides what to do.
  to: Placement | null;
};
export type DayLoad = {
  // Everything already on the day (events and blocks that stay put).
  busy: Slot[];
  // Minutes of work blocks already planned that day.
  plannedMinutes: number;
};

export const DAY_START = "09:00";
export const DAY_END = "21:00";
export const RESCHEDULE_HORIZON_DAYS = 7;

// Rounds a "HH:MM" time up to the next multiple of 5 minutes.
export function ceilToFive(time: string): string {
  const total = toMinutes(time);
  return fromMinutes(Math.min(23 * 60 + 55, Math.ceil(total / 5) * 5));
}

const later = (a: string, b: string) => (toMinutes(a) >= toMinutes(b) ? a : b);

export function proposeMoves({
  blocks,
  windowEnd,
  today,
  now,
  loadFor,
  horizonDays = RESCHEDULE_HORIZON_DAYS,
}: {
  // The blocks to move, in the order they should be placed.
  blocks: MovableBlock[];
  // The affected window ends here ("HH:MM") on each block's own day; the
  // first try is the first free slot after it.
  windowEnd: string;
  today: string;
  now: string;
  loadFor: (date: string) => DayLoad;
  horizonDays?: number;
}): ProposedMove[] {
  // What this run has already put on each day, so two moved blocks never
  // land on top of each other.
  const added = new Map<string, { slots: Slot[]; minutes: number }>();

  return blocks.map((block) => {
    const minutes = durationMinutes(block.start, block.end);
    const from: Placement = { date: block.date, start: block.start, end: block.end };

    for (let offset = 0; offset <= horizonDays; offset++) {
      const date = shiftDate(block.date, offset);
      if (date < today) continue;

      const load = loadFor(date);
      const extra = added.get(date) ?? { slots: [], minutes: 0 };
      // Never pile a day past the heavy-day line to make room.
      if (load.plannedMinutes + extra.minutes + minutes > HEAVY_DAY_MINUTES) continue;

      let earliest = DAY_START;
      if (offset === 0) earliest = later(earliest, ceilToFive(windowEnd));
      if (date === today) earliest = later(earliest, ceilToFive(now));

      const start = firstFreeStart([...load.busy, ...extra.slots], minutes, earliest, DAY_END);
      if (!start) continue;

      const to: Placement = { date, start, end: fromMinutes(toMinutes(start) + minutes) };
      added.set(date, {
        slots: [...extra.slots, { start: to.start, end: to.end }],
        minutes: extra.minutes + minutes,
      });
      return { id: block.id, title: block.title, from, to };
    }
    return { id: block.id, title: block.title, from, to: null };
  });
}
