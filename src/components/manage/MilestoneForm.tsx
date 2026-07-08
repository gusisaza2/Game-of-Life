"use client";

import { createMilestone } from "@/app/manage/actions";

export function MilestoneForm({ goalId }: { goalId: string }) {
  return (
    <form action={createMilestone} className="flex gap-2">
      <input type="hidden" name="goalId" value={goalId} />
      <input
        name="title"
        placeholder="New milestone…"
        required
        className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
      />
      <button
        type="submit"
        className="rounded bg-foreground/10 px-2 py-1 text-xs hover:bg-foreground/20"
      >
        Add
      </button>
    </form>
  );
}
