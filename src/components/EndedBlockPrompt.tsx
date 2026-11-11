"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { markBlockPrompted, moveBlock, moveBlockToNextFree } from "@/app/agenda/actions";
import { deleteBlock, setBlockStatus } from "@/app/plan/actions";
import { ItemSheet, Sheet, type AgendaItem } from "@/components/AgendaSheets";
import { shiftDate } from "@/lib/deadline";
import { formatEventDate } from "@/lib/events";
import { durationMinutes, formatBlockRange } from "@/lib/time-blocks";

export type EndedBlock = {
  id: string;
  taskId: string;
  title: string;
  date: string;
  start: string;
  end: string;
};

// The sheet portals to <body>, which only exists in the browser; render it
// only once we're there so the server HTML and the first client render agree.
const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

type Step = "ask" | "reschedule" | "confirmDelete";

// "Your work block ended": shown on Today, once per block, when the app is
// opened after a planned block's time has passed. Three answers -- worked on
// it, reschedule, delete -- or "Decide later", which just closes it (the block
// stays in the Agenda with its usual buttons; nothing is penalized).
// The server remembers the question was asked (prompted_at), so it isn't
// repeated on this or any other device.
export function EndedBlockPrompt({
  blocks,
  playerId,
  today,
  nowTime,
}: {
  blocks: EndedBlock[];
  playerId: string;
  today: string;
  nowTime: string;
}) {
  const isClient = useIsClient();
  const [isPending, startTransition] = useTransition();
  // Hidden at once on any answer, so the next block shows without waiting for
  // the server to refresh the list.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>("ask");
  const [message, setMessage] = useState<string | null>(null);
  // "Worked on it" leads to "Is the task finished?" for that same block.
  const [finished, setFinished] = useState<EndedBlock | null>(null);
  const [picking, setPicking] = useState<EndedBlock | null>(null);

  const queue = blocks.filter((b) => !hidden.has(b.id));
  const current = queue[0];
  const moreAfter = queue.length - 1;

  if (!isClient) return null;

  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const next = (id: string) => {
    hide(id);
    setStep("ask");
    setMessage(null);
  };

  if (picking) {
    const item: AgendaItem = {
      kind: "block",
      id: picking.id,
      title: picking.title,
      date: picking.date,
      start: picking.start,
      end: picking.end,
      location: null,
      status: "planned",
    };
    return (
      <ItemSheet
        item={item}
        items={[]}
        playerId={playerId}
        today={today}
        now={nowTime}
        onClose={() => setPicking(null)}
      />
    );
  }

  if (finished) {
    const close = () => setFinished(null);
    return (
      <Sheet title="Marked as worked on" subtitle={finished.title} onClose={close}>
        <p className="text-sm text-foreground/70">
          Is the task itself finished? Checking it off in your list is what earns its XP.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const taskId = finished.taskId;
              close();
              // Wait for the sheet to unmount (it locks page scroll while open).
              window.setTimeout(() => {
                document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 60);
            }}
            className="btn-primary rounded px-3 py-1.5 text-sm"
          >
            Yes, take me to it
          </button>
          <button type="button" onClick={close} className="link-hover rounded px-3 py-1.5 text-sm text-foreground/60">
            Not yet
          </button>
        </div>
      </Sheet>
    );
  }

  if (!current) return null;

  const minutes = durationMinutes(current.start, current.end);
  const subtitle = `${formatEventDate(current.date)} · ${formatBlockRange(current.start, current.end)}${
    moreAfter > 0 ? ` · ${moreAfter} more after this` : ""
  }`;

  const later = () => {
    const id = current.id;
    startTransition(async () => {
      await markBlockPrompted(id);
    });
    next(id);
  };

  const btn = "rounded-lg border border-foreground/25 bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-hover disabled:opacity-60";

  return (
    <Sheet title="Your work block ended" subtitle={subtitle} onClose={later}>
      <p className="text-sm font-medium">{current.title}</p>

      {step === "ask" && (
        <>
          <p className="text-sm text-foreground/60">What happened with it?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              className="btn-primary rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              onClick={() => {
                const block = current;
                startTransition(async () => {
                  await setBlockStatus(block.id, "done");
                });
                hide(block.id);
                setFinished(block);
              }}
            >
              Completed
            </button>
            <button type="button" disabled={isPending} className={btn} onClick={() => setStep("reschedule")}>
              Reschedule
            </button>
            <button type="button" disabled={isPending} className={btn} onClick={() => setStep("confirmDelete")}>
              Delete
            </button>
          </div>
          <button type="button" onClick={later} className="link-hover self-start text-xs text-foreground/50">
            Decide later
          </button>
        </>
      )}

      {step === "reschedule" && (
        <>
          <p className="text-sm text-foreground/60">Where should it go?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              className={btn}
              onClick={() => {
                const id = current.id;
                startTransition(async () => {
                  const placed = await moveBlockToNextFree(playerId, id);
                  if (placed) next(id);
                  else setMessage("No free slot in the next 7 days.");
                });
              }}
            >
              Next free slot
            </button>
            <button
              type="button"
              disabled={isPending}
              className={btn}
              onClick={() => {
                const id = current.id;
                startTransition(async () => {
                  const ok = await moveBlock(id, shiftDate(today, 1), current.start.slice(0, 5), minutes);
                  if (ok) next(id);
                  else setMessage("That didn’t work — try another time.");
                });
              }}
            >
              Tomorrow, same time
            </button>
            <button type="button" disabled={isPending} className={btn} onClick={() => setPicking(current)}>
              Pick a time…
            </button>
          </div>
          {message && <p className="text-xs" style={{ color: "var(--accent-effort)" }}>{message}</p>}
          <button type="button" onClick={() => setStep("ask")} className="link-hover self-start text-xs text-foreground/50">
            Back
          </button>
        </>
      )}

      {step === "confirmDelete" && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 p-3">
          <p className="text-sm font-medium">Delete this work block?</p>
          <p className="text-xs text-foreground/60">
            The task stays as it is and no XP changes. Only the reserved time disappears. If the time just didn’t
            work out, you can reschedule it instead.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              disabled={isPending}
              className="font-medium text-red-500 hover:text-red-400"
              onClick={() => {
                const id = current.id;
                const fd = new FormData();
                fd.set("blockId", id);
                startTransition(async () => {
                  await deleteBlock(fd);
                });
                next(id);
              }}
            >
              Yes, delete it
            </button>
            <button type="button" className="link-hover" onClick={() => setStep("reschedule")}>
              Reschedule instead
            </button>
            <button type="button" className="link-hover text-foreground/60" onClick={() => setStep("ask")}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
