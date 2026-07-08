"use client";

import { createGoal } from "@/app/manage/actions";

type Area = { id: string; name: string };

export function GoalForm({ playerId, areas }: { playerId: string; areas: Area[] }) {
  return (
    <form
      action={createGoal}
      className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4"
    >
      <input type="hidden" name="playerId" value={playerId} />

      <input
        name="title"
        placeholder="Goal title"
        required
        className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
      />

      <label className="text-xs text-foreground/60">
        Primary area
        <select
          name="areaId"
          required
          className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm text-foreground"
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs text-foreground/60">Secondary areas (optional)</legend>
        {areas.map((area) => (
          <label key={area.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="secondaryAreaIds" value={area.id} />
            {area.name}
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        className="self-start rounded bg-foreground/10 px-3 py-1 text-sm hover:bg-foreground/20"
      >
        Add Goal
      </button>
    </form>
  );
}
