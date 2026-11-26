import { compareByDeadline } from "@/lib/deadline";

// Today never shows more than this many open chores -- and the Good Day asks
// for no more than that (see calculateChorePct).
export const CHORES_ON_TODAY = 3;

export type ChoreCandidate = {
  id: string;
  title: string;
  due_date: string | null;
  today_pick: string | null;
  // The player set aside time for it today.
  hasBlockToday: boolean;
  // Today would show it on its own: undated, due soon or overdue.
  due: boolean;
};

// Which open chores take Today's slots: the ones the player picked (oldest
// pick first), then any with a work block today, then the most urgent of the
// ones that are due. Chores that aren't due yet only appear if chosen.
export function chooseTodayChores(open: ChoreCandidate[]): string[] {
  const picked = open
    .filter((c) => c.today_pick !== null)
    .sort((a, b) => (a.today_pick as string).localeCompare(b.today_pick as string));
  const blocked = open.filter((c) => c.today_pick === null && c.hasBlockToday).sort(compareByDeadline);
  const urgent = open
    .filter((c) => c.today_pick === null && !c.hasBlockToday && c.due)
    .sort(compareByDeadline);
  return [...picked, ...blocked, ...urgent].slice(0, CHORES_ON_TODAY).map((c) => c.id);
}
