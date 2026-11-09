import { formatTime } from "@/lib/events";

// Work blocks: time the player sets aside, by their own choice, to work on a
// task. A block never completes its task, awards no XP, and doesn't count
// toward the Good Day -- it only records that the time was set aside and
// whether it was used. (Events, by contrast, are fixed by someone else.)

export type BlockStatus = "planned" | "done" | "skipped";

// Past this much planned work in one day, the plan page says so -- gently.
// The game's question is how much responsibility the player can sustain.
export const HEAVY_DAY_MINUTES = 6 * 60;

export const DURATION_CHOICES = [30, 60, 120] as const;

const MIN_BLOCK_MINUTES = 15;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

// "14:30" or "14:30:00" -> 870
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 870 -> "14:30"
export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// End time for a block starting at `startTime` and lasting `minutes`, or null
// when it's too short or would run past the end of the day.
export function endTimeFor(startTime: string, minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < MIN_BLOCK_MINUTES) return null;
  const end = toMinutes(startTime) + minutes;
  return end > LAST_MINUTE_OF_DAY ? null : fromMinutes(end);
}

export function durationMinutes(startTime: string, endTime: string): number {
  return toMinutes(endTime) - toMinutes(startTime);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatBlockRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// A slot on one day. An event that runs past midnight (end before start) is
// treated as lasting until the end of the day.
export type Slot = { start: string; end: string };

function slotMinutes(slot: Slot): [number, number] {
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  return [start, end > start ? end : 24 * 60];
}

export function overlaps(a: Slot, b: Slot): boolean {
  const [aStart, aEnd] = slotMinutes(a);
  const [bStart, bEnd] = slotMinutes(b);
  return aStart < bEnd && bStart < aEnd;
}

// First time on the day (between `dayStart` and `dayEnd`) where a block of
// `minutes` fits without touching anything in `busy`; null when the day has
// no room left.
export function firstFreeStart(
  busy: Slot[],
  minutes: number,
  dayStart = "09:00",
  dayEnd = "21:00",
): string | null {
  const ranges = busy.map(slotMinutes).sort((a, b) => a[0] - b[0]);
  let cursor = toMinutes(dayStart);
  const limit = toMinutes(dayEnd);
  for (const [start, end] of ranges) {
    if (start - cursor >= minutes && cursor + minutes <= limit) return fromMinutes(cursor);
    cursor = Math.max(cursor, end);
  }
  return cursor + minutes <= limit ? fromMinutes(cursor) : null;
}

// Total planned work on a day. Skipped blocks no longer count.
export function plannedMinutes(blocks: { start: string; end: string; status: string }[]): number {
  return blocks
    .filter((b) => b.status !== "skipped")
    .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0);
}
