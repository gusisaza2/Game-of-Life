import { shiftDate } from "@/lib/deadline";
import { toMinutes } from "@/lib/time-blocks";

type Timed = { id: string; start: string; end: string };

// An item that ends at or before it starts runs past midnight; on a one-day
// view it simply lasts until the end of the day.
function span(item: Timed): [number, number] {
  const start = toMinutes(item.start);
  const end = toMinutes(item.end);
  return [start, end > start ? end : 24 * 60];
}

// Places items on a day's timeline. Items that overlap in time share the
// width side by side: each gets a column and the number of columns its
// overlapping group needs.
export function layoutColumns<T extends Timed>(items: T[]): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => span(a)[0] - span(b)[0] || span(b)[1] - span(a)[1]);
  const result: (T & { col: number; cols: number })[] = [];

  let group: (T & { col: number; cols: number })[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const closeGroup = () => {
    for (const item of group) item.cols = columnEnds.length;
    result.push(...group);
    group = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    const [start, end] = span(item);
    if (group.length > 0 && start >= groupEnd) closeGroup();

    let col = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    group.push({ ...item, col, cols: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length > 0) closeGroup();
  return result;
}

// Monday of the week a date falls in, and the seven days from there.
export function weekDates(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  const monday = shiftDate(date, -((dayOfWeek + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
