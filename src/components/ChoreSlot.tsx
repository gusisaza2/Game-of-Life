"use client";

import { useState, useTransition } from "react";
import { setTodayChores } from "@/app/chores/actions";
import { Badge } from "@/components/Badge";
import { CHORES_ON_TODAY } from "@/lib/chores";

// On the chores page: says whether a chore holds one of Today's slots, and
// lets the player swap it in for one that does.
export function ChoreSlot({
  chore,
  active,
}: {
  chore: { id: string };
  active: { id: string; title: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);

  if (active.some((c) => c.id === chore.id)) return <Badge tone="balance">On Today</Badge>;

  const hasRoom = active.length < CHORES_ON_TODAY;
  const save = (ids: string[]) => {
    setFailed(false);
    startTransition(async () => {
      const ok = await setTodayChores(ids);
      if (ok) setAsking(false);
      else setFailed(true);
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => (hasRoom ? save([...active.map((c) => c.id), chore.id]) : setAsking(!asking))}
        className="ml-auto rounded-lg border border-foreground/25 bg-background px-2.5 py-1 text-xs transition-colors hover:bg-surface-hover disabled:opacity-50"
      >
        {hasRoom ? "Add to Today" : asking ? "Cancel" : "Swap in"}
      </button>
      {asking && !hasRoom && (
        <div className="flex w-full flex-col gap-1.5 rounded-lg border border-foreground/15 p-2">
          <p className="text-xs text-foreground/55">Which one comes off Today?</p>
          {active.map((current) => (
            <button
              key={current.id}
              type="button"
              disabled={isPending}
              onClick={() => save(active.map((c) => (c.id === current.id ? chore.id : c.id)))}
              className="rounded-lg border border-foreground/20 bg-surface px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              Replace “{current.title}”
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p className="w-full text-xs" style={{ color: "var(--accent-effort)" }}>
          That didn’t save — try again.
        </p>
      )}
    </>
  );
}
