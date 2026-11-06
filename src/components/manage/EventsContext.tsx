"use client";

import { createContext, useContext } from "react";
import type { ManageEvent } from "./EventRow";
import { formatEventDate } from "@/lib/events";

// Every event of the player, shared with the Manage components that need
// some slice of it (a Milestone's events, the "prepares for" picker) so the
// list doesn't have to be threaded through five levels of props.
const EventsContext = createContext<ManageEvent[]>([]);

export function EventsProvider({
  events,
  children,
}: {
  events: ManageEvent[];
  children: React.ReactNode;
}) {
  return <EventsContext.Provider value={events}>{children}</EventsContext.Provider>;
}

export function useEvents(): ManageEvent[] {
  return useContext(EventsContext);
}

export type EventOption = { id: string; label: string; date: string };

// Events a task can still be prepared for: the ones that haven't happened.
export function useEventOptions(): EventOption[] {
  return useEvents()
    .filter((e) => e.status === "scheduled")
    .sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0))
    .map((e) => ({ id: e.id, label: `${e.title} · ${formatEventDate(e.event_date)}`, date: e.event_date }));
}
