"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  alignPrepDeadlines,
  applyBlockMoves,
  moveBlock,
  moveBlockToNextFree,
  moveEvent,
  proposeReschedule,
  type EventInWindow,
  type LateTask,
} from "@/app/agenda/actions";
import { deleteBlock, setBlockStatus } from "@/app/plan/actions";
import { setEventStatus } from "@/app/events/actions";
import { Badge } from "@/components/Badge";
import { formatEventDate } from "@/lib/events";
import { shiftDate } from "@/lib/deadline";
import {
  DURATION_CHOICES,
  durationMinutes,
  formatBlockRange,
  formatDuration,
  fromMinutes,
  overlaps,
  toMinutes,
  type Slot,
} from "@/lib/time-blocks";
import type { ProposedMove } from "@/lib/reschedule";

export type AgendaItem = {
  kind: "event" | "block";
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string | null;
  areaName?: string;
  status: string;
};

const fieldClass = "rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm";
const chipClass = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs transition-colors ${
    active ? "border-foreground/50 bg-foreground/10 font-medium" : "border-foreground/20 text-foreground/60"
  }`;

// A bottom sheet. Portaled to <body> because template.tsx's page transition
// puts a CSS transform on the page, which would otherwise become the
// containing block for this fixed overlay (see CLAUDE.md).
function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex max-h-[88vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border border-foreground/20 bg-background p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-foreground/50">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="link-hover shrink-0 text-sm text-foreground/50">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function clashWith(items: AgendaItem[], self: AgendaItem, date: string, slot: Slot): AgendaItem | undefined {
  return items.find(
    (other) =>
      other.id !== self.id &&
      other.date === date &&
      other.status !== "skipped" &&
      overlaps({ start: other.start, end: other.end }, slot),
  );
}

// Move or change one work block.
function BlockSheet({
  item,
  items,
  playerId,
  today,
  now,
  onClose,
}: {
  item: AgendaItem;
  items: AgendaItem[];
  playerId: string;
  today: string;
  now: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const length = durationMinutes(item.start, item.end);
  const [date, setDate] = useState(item.date < today ? today : item.date);
  const [start, setStart] = useState(item.start.slice(0, 5));
  const [minutes, setMinutes] = useState(length);
  const [message, setMessage] = useState<string | null>(null);

  const end = toMinutes(start) + minutes <= 23 * 60 + 59 ? fromMinutes(toMinutes(start) + minutes) : null;
  const clash = end ? clashWith(items, item, date, { start, end }) : undefined;

  function run(action: () => Promise<boolean | void>, done?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result === false) {
        setMessage("That didn’t work — check the date and time.");
        return;
      }
      done?.();
      onClose();
    });
  }

  const shift = (deltaMinutes: number) => {
    const next = toMinutes(item.start) + deltaMinutes;
    if (next < 0 || next + length > 23 * 60 + 59) return;
    run(() => moveBlock(item.id, item.date < today ? today : item.date, fromMinutes(next), length));
  };

  const isDone = item.status === "done";
  // The day after the block's own day (and never earlier than tomorrow, for
  // a block whose day has already passed).
  const nextDay = shiftDate(item.date < today ? today : item.date, 1);

  return (
    <Sheet
      title={item.title}
      subtitle={`Work block · ${formatEventDate(item.date)} · ${formatBlockRange(item.start, item.end)}`}
      onClose={onClose}
    >
      {isDone ? (
        <div className="flex flex-col gap-3">
          <Badge tone="balance">Done</Badge>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setBlockStatus(item.id, "planned"))}
            className="link-hover self-start text-sm text-foreground/60"
          >
            Undo — mark it as planned again
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={isPending} onClick={() => shift(30)} className={chipClass(false)}>
              +30 min
            </button>
            <button type="button" disabled={isPending} onClick={() => shift(60)} className={chipClass(false)}>
              +1 hour
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => moveBlock(item.id, nextDay, item.start.slice(0, 5), length))}
              className={chipClass(false)}
            >
              {item.date <= today ? "Tomorrow" : "Next day"}, same time
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const placed = await moveBlockToNextFree(playerId, item.id);
                  if (placed) onClose();
                  else setMessage("No free slot in the next 7 days.");
                })
              }
              className={chipClass(false)}
            >
              Next free slot
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                Day
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                Starts
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...DURATION_CHOICES, 90, 180, length])].sort((a, b) => a - b).map((m) => (
                <button key={m} type="button" onClick={() => setMinutes(m)} className={chipClass(minutes === m)}>
                  {formatDuration(m)}
                </button>
              ))}
            </div>
            {end === null && (
              <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
                That doesn’t fit in the day.
              </p>
            )}
            {clash && (
              <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
                Overlaps with {clash.title}. You can still save it.
              </p>
            )}
            <button
              type="button"
              disabled={isPending || end === null || !date}
              onClick={() => run(() => moveBlock(item.id, date, start, minutes))}
              className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
            >
              Save
            </button>
          </div>

          {message && <p className="text-xs" style={{ color: "var(--accent-effort)" }}>{message}</p>}

          <div className="flex gap-4 text-xs">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => setBlockStatus(item.id, "skipped"))}
              className="link-hover text-foreground/60"
            >
              Skip it
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("blockId", item.id);
                run(() => deleteBlock(fd));
              }}
              className="text-foreground/40 hover:text-red-500"
            >
              Remove
            </button>
          </div>
          {item.date === today && toMinutes(item.end) <= toMinutes(now) && (
            <p className="text-xs text-foreground/45">
              This one’s time has passed — move it, or mark how it went from Today.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}

// Reschedule an event (something changed outside the app) or cancel it.
function EventSheet({
  item,
  items,
  playerId,
  today,
  onClose,
}: {
  item: AgendaItem;
  items: AgendaItem[];
  playerId: string;
  today: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(item.date < today ? today : item.date);
  const [start, setStart] = useState(item.start.slice(0, 5));
  const [end, setEnd] = useState(item.end.slice(0, 5));
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [late, setLate] = useState<LateTask[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clash = clashWith(items, item, date, { start, end });
  const isHappened = item.status === "happened";

  return (
    <Sheet
      title={item.title}
      subtitle={`Event · ${formatEventDate(item.date)} · ${formatBlockRange(item.start, item.end)}${
        item.location ? ` · ${item.location}` : ""
      }`}
      onClose={onClose}
    >
      {isHappened ? (
        <p className="text-sm text-foreground/60">
          This one already happened. Reopen it from Manage if you need to change it.
        </p>
      ) : late ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Moved. These prep tasks are now due on or after the event:</p>
          <ul className="flex flex-col gap-1 text-sm text-foreground/80">
            {late.map((task) => (
              <li key={task.id}>
                {task.title} <span className="text-xs text-foreground/45">(due {formatEventDate(task.due_date)})</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await alignPrepDeadlines(item.id);
                  onClose();
                })
              }
              className="btn-primary rounded px-3 py-1 text-sm disabled:opacity-60"
            >
              Move them to the day before
            </button>
            <button type="button" onClick={onClose} className="link-hover text-sm text-foreground/60">
              Leave them
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                Day
                <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                From
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass} />
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                To
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={fieldClass} />
              </label>
            </div>
            {clash && (
              <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
                Overlaps with {clash.title}. You can still save it.
              </p>
            )}
            <button
              type="button"
              disabled={isPending || !date || !start || !end}
              onClick={() =>
                startTransition(async () => {
                  const result = await moveEvent(item.id, date, start, end);
                  if (!result.ok) {
                    setMessage("That didn’t work — check the date and time.");
                    return;
                  }
                  if (result.lateTasks.length > 0) setLate(result.lateTasks);
                  else onClose();
                })
              }
              className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
            >
              Save new time
            </button>
          </div>
          {message && <p className="text-xs" style={{ color: "var(--accent-effort)" }}>{message}</p>}

          <div className="flex items-center gap-3 text-xs">
            {confirmingCancel ? (
              <>
                <span className="text-foreground/60">Cancel this event?</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await setEventStatus(item.id, playerId, "cancelled");
                      onClose();
                    })
                  }
                  className="font-medium text-red-500 hover:text-red-400"
                >
                  Yes, cancel it
                </button>
                <button type="button" onClick={() => setConfirmingCancel(false)} className="link-hover text-foreground/60">
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="text-foreground/40 hover:text-red-500"
              >
                Cancel the event
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

export function ItemSheet(props: {
  item: AgendaItem;
  items: AgendaItem[];
  playerId: string;
  today: string;
  now: string;
  onClose: () => void;
}) {
  return props.item.kind === "block" ? <BlockSheet {...props} /> : <EventSheet {...props} />;
}

// Where a proposed block lands, relative to where it was: "Same day" reads
// better than a countdown when the whole day being planned is weeks away.
function moveDayLabel(fromDate: string, toDate: string, today: string): string {
  if (toDate === fromDate) return "Same day";
  if (toDate === today) return "Today";
  if (toDate === shiftDate(today, 1)) return "Tomorrow";
  return formatEventDate(toDate);
}

// "Something came up": pick the stretch of time that's gone, see where the
// work blocks in it could go instead, and confirm. Nothing moves until the
// player applies.
export function ReschedulePanel({
  playerId,
  date,
  today,
  now,
  onClose,
  onEditEvent,
}: {
  playerId: string;
  date: string;
  today: string;
  now: string;
  onClose: () => void;
  onEditEvent: (eventId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isToday = date === today;
  const [from, setFrom] = useState(isToday ? now : "00:00");
  const [to, setTo] = useState("23:59");
  const [result, setResult] = useState<{ moves: ProposedMove[]; events: EventInWindow[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<number | null>(null);

  const presets: { label: string; from: string; to: string }[] = [
    { label: isToday ? "Rest of today" : "The whole day", from: isToday ? now : "00:00", to: "23:59" },
    ...(isToday
      ? [{ label: "Next 2 hours", from: now, to: fromMinutes(Math.min(23 * 60 + 59, toMinutes(now) + 120)) }]
      : []),
  ];

  function propose() {
    startTransition(async () => {
      const next = await proposeReschedule(playerId, date, from, to);
      setResult(next);
      setSelected(new Set(next.moves.filter((m) => m.to).map((m) => m.id)));
      setApplied(null);
    });
  }

  function apply() {
    if (!result) return;
    const moves = result.moves
      .filter((m) => m.to && selected.has(m.id))
      .map((m) => ({ id: m.id, ...m.to! }));
    startTransition(async () => {
      const count = await applyBlockMoves(moves);
      setApplied(count);
      setResult(null);
    });
  }

  return (
    <Sheet
      title="Something came up"
      subtitle={`${formatEventDate(date)} — tell me when you’re not available and I’ll suggest where your work blocks can go.`}
      onClose={onClose}
    >
      {applied !== null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {applied === 0 ? "Nothing was moved." : `Moved ${applied} work block${applied === 1 ? "" : "s"}.`}
          </p>
          <button type="button" onClick={onClose} className="btn-primary self-start rounded px-3 py-1 text-sm">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-3">
            <p className="text-xs text-foreground/60">I’m not available…</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setFrom(preset.from);
                    setTo(preset.to);
                    setResult(null);
                  }}
                  className={chipClass(from === preset.from && to === preset.to)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                From
                <input
                  type="time"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setResult(null);
                  }}
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                Until
                <input
                  type="time"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setResult(null);
                  }}
                  className={fieldClass}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={isPending || !from || !to}
              onClick={propose}
              className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
            >
              Show me a new plan
            </button>
          </div>

          {result && (
            <div className="flex flex-col gap-3">
              {result.events.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-lg bg-surface-hover p-3">
                  <p className="text-xs text-foreground/60">
                    These events are in that time. I don’t move events — change them yourself:
                  </p>
                  {result.events.map((event) => (
                    <div key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        {event.title}{" "}
                        <span className="text-xs text-foreground/45">{formatBlockRange(event.start, event.end)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditEvent(event.id)}
                        className="link-hover shrink-0 text-xs text-foreground/60"
                      >
                        Change
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {result.moves.length === 0 ? (
                <p className="text-sm text-foreground/60">You have no work blocks in that time. Nothing to move.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {result.moves.map((move) => (
                    <li key={move.id} className="flex items-start gap-3 rounded-lg border border-foreground/15 bg-surface p-3 text-sm">
                      <input
                        type="checkbox"
                        disabled={!move.to}
                        checked={selected.has(move.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(move.id);
                            else next.delete(move.id);
                            return next;
                          })
                        }
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span>{move.title}</span>
                        <span className="text-xs text-foreground/50">
                          {formatBlockRange(move.from.start, move.from.end)}
                          {move.to ? (
                            <>
                              {" → "}
                              <span className="font-medium text-foreground/80">
                                {moveDayLabel(move.from.date, move.to.date, today)}
                              </span>
                              {" · "}
                              {formatBlockRange(move.to.start, move.to.end)}
                            </>
                          ) : (
                            " — no room in the next 7 days, leave it"
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {result.moves.some((m) => m.to) && (
                <button
                  type="button"
                  disabled={isPending || selected.size === 0}
                  onClick={apply}
                  className="btn-primary self-start rounded px-3 py-1.5 text-sm disabled:opacity-60"
                >
                  Apply {selected.size} change{selected.size === 1 ? "" : "s"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
