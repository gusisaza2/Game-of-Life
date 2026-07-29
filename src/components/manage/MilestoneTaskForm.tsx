"use client";

import { useState } from "react";
import { createTask } from "@/app/manage/actions";

type Area = { id: string; name: string };

// Adds a Task already linked to this Milestone. Defaults to inactive
// ("planned" — not due yet, doesn't show on Today or earn XP) so a whole
// backlog of future tasks can be sketched out for a Milestone up front;
// "Activate now" opts a task into being live immediately instead.
export function MilestoneTaskForm({
  milestoneId,
  playerId,
  areas,
  defaultAreaId,
}: {
  milestoneId: string;
  playerId: string;
  areas: Area[];
  defaultAreaId: string;
}) {
  const [tier, setTier] = useState("habit");
  const [activateNow, setActivateNow] = useState(false);

  return (
    <form
      action={createTask}
      className="flex flex-col gap-1.5 rounded-lg border border-dashed border-foreground/15 p-2.5"
    >
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="isActive" value={activateNow ? "true" : "false"} />

      <input
        name="title"
        placeholder="New task for this milestone…"
        required
        className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
      />

      <div className="flex gap-1.5">
        <select
          name="tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
        >
          <option value="habit">Habit</option>
          <option value="main_task">Main Task</option>
        </select>

        <select
          name="areaId"
          defaultValue={defaultAreaId}
          required
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>

        <select
          name="recurrence"
          defaultValue="daily"
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-foreground/60">
          <input
            type="checkbox"
            checked={activateNow}
            onChange={(e) => setActivateNow(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Activate now
        </label>
        <button
          type="submit"
          className="rounded bg-foreground/10 px-2.5 py-1 text-xs hover:bg-foreground/20"
        >
          Add
        </button>
      </div>
    </form>
  );
}
