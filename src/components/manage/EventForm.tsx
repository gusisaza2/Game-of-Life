"use client";

import { useTransition } from "react";
import { createEvent, updateEvent } from "@/app/events/actions";
import { getTodayDateString } from "@/lib/today";

type Area = { id: string; name: string };
type MilestoneOption = { id: string; label: string };

export type EditableEvent = {
  id: string;
  title: string;
  area_id: string;
  milestone_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
};

const inputClass = "rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm";

// Creates an event, or edits one when `event` is passed. When `milestoneId`
// is given (the form sits under a Milestone) it's fixed to it; otherwise the
// Milestone is an optional picker -- an event can stand alone.
export function EventForm({
  playerId,
  areas,
  milestoneOptions,
  event,
  milestoneId,
  defaultAreaId,
  onDone,
}: {
  playerId: string;
  areas: Area[];
  milestoneOptions: MilestoneOption[];
  event?: EditableEvent;
  milestoneId?: string;
  defaultAreaId?: string;
  onDone?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          if (event) await updateEvent(formData);
          else await createEvent(formData);
          onDone?.();
        })
      }
      className="flex flex-col gap-2 rounded-lg border border-foreground/20 bg-surface p-3"
    >
      <input type="hidden" name="playerId" value={playerId} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      {milestoneId && <input type="hidden" name="milestoneId" value={milestoneId} />}

      <input
        name="title"
        placeholder="Event title (e.g. Guitar recording)"
        defaultValue={event?.title}
        required
        className={inputClass}
      />

      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[140px] flex-1 flex-col gap-0.5 text-xs text-foreground/60">
          Date
          <input
            type="date"
            name="eventDate"
            required
            min={event ? undefined : getTodayDateString()}
            defaultValue={event?.event_date}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-[100px] flex-1 flex-col gap-0.5 text-xs text-foreground/60">
          From
          <input
            type="time"
            name="startTime"
            required
            defaultValue={event?.start_time.slice(0, 5)}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-[100px] flex-1 flex-col gap-0.5 text-xs text-foreground/60">
          To
          <input
            type="time"
            name="endTime"
            required
            defaultValue={event?.end_time.slice(0, 5)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          name="areaId"
          required
          defaultValue={event?.area_id ?? defaultAreaId}
          className={`min-w-[140px] flex-1 ${inputClass}`}
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        <input
          name="location"
          placeholder="Where (optional)"
          defaultValue={event?.location ?? ""}
          className={`min-w-[140px] flex-1 ${inputClass}`}
        />
      </div>

      {!milestoneId && (
        <select
          name="milestoneId"
          defaultValue={event?.milestone_id ?? ""}
          className={inputClass}
        >
          <option value="">Not part of a Goal (standalone)</option>
          {milestoneOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      <p className="text-xs text-foreground/40">
        If it ends after midnight, set “To” earlier than “From”.
      </p>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary rounded px-3 py-1 text-sm">
          {event ? "Save" : "Add event"}
        </button>
        {event && (
          <button
            type="button"
            onClick={onDone}
            className="link-hover rounded px-3 py-1 text-sm text-foreground/60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
