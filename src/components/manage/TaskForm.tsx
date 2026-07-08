"use client";

import { useState } from "react";
import { createTask } from "@/app/manage/actions";

type Area = { id: string; name: string };
type MilestoneOption = { id: string; label: string };

export function TaskForm({
  playerId,
  areas,
  milestoneOptions,
}: {
  playerId: string;
  areas: Area[];
  milestoneOptions: MilestoneOption[];
}) {
  const [tier, setTier] = useState("habit");

  return (
    <form
      action={createTask}
      className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4"
    >
      <input type="hidden" name="playerId" value={playerId} />

      <input
        name="title"
        placeholder="Task title"
        required
        className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
      />

      <div className="flex gap-2">
        <select
          name="tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        >
          <option value="habit">Habit</option>
          <option value="main_task">Main Task</option>
          <option value="chore">Chore</option>
        </select>

        <select
          name="areaId"
          required
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>

        <select
          name="recurrence"
          className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {tier === "main_task" && (
        <select
          name="milestoneId"
          required
          className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
        >
          <option value="">Link to a Milestone…</option>
          {milestoneOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      {tier === "main_task" && milestoneOptions.length === 0 && (
        <p className="text-xs text-foreground/60">
          No active Milestones yet — add one under a Goal below first.
        </p>
      )}

      <button
        type="submit"
        className="self-start rounded bg-foreground/10 px-3 py-1 text-sm hover:bg-foreground/20"
      >
        Add Task
      </button>
    </form>
  );
}
