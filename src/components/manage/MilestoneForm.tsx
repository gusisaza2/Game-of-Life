"use client";

import { createMilestone } from "@/app/manage/actions";

export function MilestoneForm({ goalId }: { goalId: string }) {
  return (
    <form
      action={async (formData) => {
        await createMilestone(formData);
      }}
      className="flex gap-2"
    >
      <input type="hidden" name="goalId" value={goalId} />
      <input
        name="title"
        placeholder="New milestone…"
        required
        className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-xs"
      />
      <button type="submit" className="btn-primary rounded px-2 py-1 text-xs">
        Add
      </button>
    </form>
  );
}
