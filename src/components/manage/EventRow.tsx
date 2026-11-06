"use client";

import { useState, useTransition } from "react";
import { deleteEvent, setEventStatus } from "@/app/events/actions";
import { areaColor } from "@/lib/area-colors";
import { Badge } from "@/components/Badge";
import { AreaIcon } from "@/components/AreaIcon";
import { EventForm, type EditableEvent } from "./EventForm";
import { formatEventDate, formatTimeRange } from "@/lib/events";

type Area = { id: string; name: string };
type MilestoneOption = { id: string; label: string };
export type ManageEvent = EditableEvent & { status: string };

export function EventRow({
  event,
  areas,
  milestoneOptions,
  playerId,
  milestoneLabel,
  lockMilestone = false,
}: {
  event: ManageEvent;
  areas: Area[];
  milestoneOptions: MilestoneOption[];
  playerId: string;
  milestoneLabel: string | null;
  // Under a Milestone, editing can't move the event to another one.
  lockMilestone?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const areaName = areas.find((a) => a.id === event.area_id)?.name;
  const color = areaColor(areaName);

  if (isEditing) {
    return (
      <li>
        <EventForm
          playerId={playerId}
          areas={areas}
          milestoneOptions={milestoneOptions}
          event={event}
          milestoneId={lockMilestone ? (event.milestone_id ?? undefined) : undefined}
          onDone={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-foreground/20 bg-surface px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover"
      style={{ borderLeft: `3px solid ${color.accent}` }}
    >
      <div className="flex min-w-[140px] flex-1 items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: color.soft, color: color.accent }}
        >
          <AreaIcon areaName={areaName} className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            {event.title}
            {event.status === "happened" && <Badge tone="balance">Happened</Badge>}
            {event.status === "missed" && <Badge tone="muted">Didn’t happen</Badge>}
            {event.status === "cancelled" && <Badge tone="muted">Cancelled</Badge>}
          </span>
          <span className="text-xs text-foreground/50">
            {formatEventDate(event.event_date)} · {formatTimeRange(event.start_time, event.end_time)}
          </span>
          <span className="text-xs text-foreground/40">
            {areaName}
            {event.location ? ` · ${event.location}` : ""}
            {milestoneLabel ? ` · ${milestoneLabel}` : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-foreground/60">Delete?</span>
            <form action={(formData) => startTransition(() => deleteEvent(formData))}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="playerId" value={playerId} />
              <button disabled={isPending} className="text-xs font-medium text-red-500 hover:text-red-400">
                Confirm
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="link-hover text-xs text-foreground/60"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-foreground/40 hover:text-red-500"
            >
              Delete
            </button>
            <button onClick={() => setIsEditing(true)} className="link-hover text-xs text-foreground/60">
              Edit
            </button>
            {event.status !== "scheduled" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(async () => void (await setEventStatus(event.id, playerId, "scheduled")))}
                className="link-hover text-xs text-foreground/60"
              >
                Reopen
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
