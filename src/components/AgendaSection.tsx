"use client";

import { useState, useTransition } from "react";
import { setEventStatus } from "@/app/events/actions";
import { areaColor } from "@/lib/area-colors";
import { Badge } from "@/components/Badge";
import { SectionHeading } from "@/components/SectionHeading";
import { eventDayLabel, formatTimeRange, hasStarted } from "@/lib/events";

export type AgendaEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  areaName?: string;
  kind: "upcoming" | "unresolved" | "done";
  // Names of the tasks prepared for this event that are still open.
  prepTasks: string[];
};

function AgendaItem({
  event,
  playerId,
  today,
  nowTime,
}: {
  event: AgendaEvent;
  playerId: string;
  today: string;
  nowTime: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ xp: number; nivel: string | null } | null>(null);
  const color = areaColor(event.areaName);
  const started = hasStarted(event, today, nowTime);

  function resolve(status: "happened" | "missed" | "cancelled" | "scheduled") {
    startTransition(async () => {
      const res = await setEventStatus(event.id, playerId, status);
      if (status === "happened" && res) {
        setResult({
          xp: res.xpAwarded,
          nivel: res.nivelUp ? `¡Nivel up! ${res.nivelUp.nivelReached} / ${res.nivelUp.totalNiveles}` : null,
        });
      } else {
        setResult(null);
      }
    });
  }

  const buttonClass = "link-hover text-xs text-foreground/60 disabled:opacity-50";

  return (
    <li className="flex flex-col gap-1">
      <div
        className="flex flex-col gap-1.5 rounded-xl border border-foreground/20 bg-surface py-3 pl-3 pr-4"
        style={{ borderLeft: `3px solid ${color.accent}` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span
            className={`min-w-0 ${event.kind === "done" ? "line-through text-foreground/35" : "text-foreground/90"}`}
          >
            {event.title}
          </span>
          {event.kind === "upcoming" && (
            <Badge tone={event.event_date === today ? "effort" : "neutral"}>
              {eventDayLabel(event.event_date, today)}
            </Badge>
          )}
          {event.kind === "unresolved" && <Badge tone="effort">Did it happen?</Badge>}
          {event.kind === "done" && result && (
            <span className="xp-flash text-xs font-semibold tabular-nums" style={{ color: color.accent }}>
              +{result.xp} XP
            </span>
          )}
        </div>
        <p className="text-xs text-foreground/50">
          {formatTimeRange(event.start_time, event.end_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.prepTasks.length > 0 && event.kind !== "done" && (
          <p className="text-xs text-foreground/45">
            To prepare: {event.prepTasks.join(" · ")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {event.kind === "done" ? (
            <button type="button" disabled={isPending} onClick={() => resolve("scheduled")} className={buttonClass}>
              Undo
            </button>
          ) : (
            <>
              {started ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => resolve("happened")}
                  className="btn-primary rounded px-2.5 py-1 text-xs disabled:opacity-60"
                >
                  It happened
                </button>
              ) : (
                <span className="text-xs text-foreground/35">Can be marked once it starts</span>
              )}
              {(started || event.kind === "unresolved") && (
                <button type="button" disabled={isPending} onClick={() => resolve("missed")} className={buttonClass}>
                  Didn’t happen
                </button>
              )}
              <button type="button" disabled={isPending} onClick={() => resolve("cancelled")} className={buttonClass}>
                Cancelled
              </button>
            </>
          )}
        </div>
      </div>
      {result?.nivel && (
        <p className="xp-flash px-4 text-xs font-medium" style={{ color: "var(--accent-effort)" }}>
          {result.nivel}
        </p>
      )}
    </li>
  );
}

export function AgendaSection({
  events,
  playerId,
  today,
  nowTime,
}: {
  events: AgendaEvent[];
  playerId: string;
  today: string;
  nowTime: string;
}) {
  if (events.length === 0) return null;

  return (
    <section className="w-full max-w-md">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
          Agenda
        </SectionHeading>
      </div>
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <AgendaItem key={event.id} event={event} playerId={playerId} today={today} nowTime={nowTime} />
        ))}
      </ul>
    </section>
  );
}
