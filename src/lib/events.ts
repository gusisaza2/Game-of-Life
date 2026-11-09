import { daysBetween } from "@/lib/today";

// Events happen at a set date and time (a studio session, an appointment).
// They can't be done early, so unlike tasks they have no deadline -- just a
// moment. Marking one "happened" awards XP like a Main Task (see
// event-actions); events never count toward the Good Day.

export type EventStatus = "scheduled" | "happened" | "missed" | "cancelled";

export type EventLike = {
  status: string;
  event_date: string;
  start_time: string;
  resolved_on: string | null;
};

// "14:00:00" -> "2:00 PM"
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatEventDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function eventDayLabel(eventDate: string, today: string): string {
  const days = daysBetween(today, eventDate);
  if (days < 0) return days === -1 ? "Yesterday" : `${-days} days ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// An event can only be marked "happened" once it has started: you can't do
// it early.
export function hasStarted(
  event: Pick<EventLike, "event_date" | "start_time">,
  today: string,
  nowTime: string,
): boolean {
  if (event.event_date !== today) return event.event_date < today;
  return nowTime >= event.start_time.slice(0, 5);
}

// Where an event belongs on Today's Agenda. Only today's events are shown:
// an event days away is not part of today, and a "In 3 days" label on a
// Today list reads like a deadline. Upcoming events live in the Agenda page.
//   upcoming   -- scheduled for today
//   unresolved -- scheduled, but its day has passed and nobody said how it
//                 went: asked about gently, never penalized
//   done       -- happened and marked today (so it still reads as done)
//   hidden     -- everything else (future days, missed, cancelled, old)
export function agendaPlacement(
  event: EventLike,
  today: string,
): "upcoming" | "unresolved" | "done" | "hidden" {
  if (event.status === "happened") return event.resolved_on === today ? "done" : "hidden";
  if (event.status !== "scheduled") return "hidden";
  if (event.event_date < today) return "unresolved";
  return event.event_date === today ? "upcoming" : "hidden";
}

export function compareByStart(
  a: { event_date: string; start_time: string },
  b: { event_date: string; start_time: string },
): number {
  if (a.event_date !== b.event_date) return a.event_date < b.event_date ? -1 : 1;
  return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
}
