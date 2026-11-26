"use client";

import { useState, useTransition } from "react";
import { setTodayChores } from "@/app/chores/actions";
import { Sheet } from "@/components/AgendaSheets";
import { areaColor } from "@/lib/area-colors";
import { CHORES_ON_TODAY } from "@/lib/chores";
import { deadlineLabel } from "@/lib/deadline";

export type ChoreRow = {
  id: string;
  title: string;
  due_date: string | null;
  areaName?: string;
};

function ChoreLine({ chore, today, children }: { chore: ChoreRow; today: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex min-w-[8rem] flex-1 items-baseline gap-2">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: areaColor(chore.areaName).accent }}
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">{chore.title}</span>
          <span className="text-xs text-foreground/45">
            {chore.due_date ? deadlineLabel(chore.due_date, today) : "No date"}
          </span>
        </span>
      </span>
      {children}
    </div>
  );
}

// "See all chores": Today only shows a few, so this window lists every open
// one and lets the player swap which ones are on Today.
export function AllChores({ active, others, today }: { active: ChoreRow[]; others: ChoreRow[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // The chore waiting for the player to say which active one it replaces.
  const [swapping, setSwapping] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const total = active.length + others.length;
  if (others.length === 0) return null;

  const hasRoom = active.length < CHORES_ON_TODAY;

  const save = (ids: string[]) => {
    setFailed(false);
    startTransition(async () => {
      const ok = await setTodayChores(ids);
      if (ok) setSwapping(null);
      else setFailed(true);
    });
  };

  const close = () => {
    setOpen(false);
    setSwapping(null);
    setFailed(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-hover self-start text-xs text-foreground/55">
        See all chores ({total}) →
      </button>

      {open && (
        <Sheet
          title="All chores"
          subtitle={`Today holds up to ${CHORES_ON_TODAY}. Swap in whichever you want to take on.`}
          onClose={close}
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              On Today ({active.length} of {CHORES_ON_TODAY})
            </p>
            {active.length === 0 && <p className="text-sm text-foreground/50">Nothing on Today yet.</p>}
            <ul className="flex flex-col gap-2">
              {active.map((chore) => (
                <li key={chore.id} className="rounded-xl border border-foreground/30 bg-surface px-3 py-2">
                  <ChoreLine chore={chore} today={today} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Other chores ({others.length})
            </p>
            <ul className="flex flex-col gap-2">
              {others.map((chore) => (
                <li key={chore.id} className="flex flex-col gap-2 rounded-xl border border-foreground/15 px-3 py-2">
                  <ChoreLine chore={chore} today={today}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        hasRoom
                          ? save([...active.map((c) => c.id), chore.id])
                          : setSwapping(swapping === chore.id ? null : chore.id)
                      }
                      className="shrink-0 rounded-lg border border-foreground/25 bg-background px-2.5 py-1 text-xs transition-colors hover:bg-surface-hover disabled:opacity-50"
                    >
                      {hasRoom ? "Add to Today" : swapping === chore.id ? "Cancel" : "Swap in"}
                    </button>
                  </ChoreLine>
                  {swapping === chore.id && !hasRoom && (
                    <div className="flex flex-col gap-1.5 border-t border-foreground/10 pt-2">
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
                </li>
              ))}
            </ul>
          </div>

          {isPending && <p className="text-xs text-foreground/50">Saving…</p>}
          {failed && (
            <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
              That didn’t save — try again.
            </p>
          )}
        </Sheet>
      )}
    </>
  );
}
