"use client";

import { useState, useTransition } from "react";
import { rescheduleTasks } from "@/app/overdue/actions";
import { Sheet } from "@/components/AgendaSheets";
import { shiftDate } from "@/lib/deadline";
import { formatEventDate } from "@/lib/events";
import { nextMonday, spreadDates } from "@/lib/overdue";
import { daysBetween } from "@/lib/today";

export type OverdueItem = {
  id: string;
  title: string;
  due_date: string;
  // The Goal it belongs to, or "Chores" for the ones without a Goal.
  group: string;
};

type Target = { kind: "date"; date: string } | { kind: "spread"; days: number };

const chip = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs transition-colors ${
    active ? "border-foreground/50 bg-foreground/10 font-medium" : "border-foreground/20 text-foreground/60"
  }`;

// "N tasks are past their date": a quiet card on Today that opens a panel to
// give them new dates in one go. Overdue tasks pile up when dates set in
// advance stop being true; this is how they get honest again, without
// editing them one by one. Nothing here costs XP or breaks anything.
export function OverduePanel({ items, today }: { items: OverdueItem[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Everything starts selected; what the player unticks is remembered, so
  // tasks that become overdue later start selected too.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<Target | null>(null);
  const [moved, setMoved] = useState<number | null>(null);

  if (items.length === 0 && moved === null) return null;

  const isSelected = (id: string) => !skipped.has(id);
  const chosen = items.filter((i) => isSelected(i.id));
  const tomorrow = shiftDate(today, 1);
  const quickDates = [
    { label: "Tomorrow", date: tomorrow },
    { label: "In 3 days", date: shiftDate(today, 3) },
    { label: "Next Monday", date: nextMonday(today) },
    { label: "In a week", date: shiftDate(today, 7) },
  ];

  const groups = [...new Set(items.map((i) => i.group))].map((name) => ({
    name,
    items: items.filter((i) => i.group === name),
  }));

  const toggle = (ids: string[], on: boolean) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // Where each chosen task would land (chosen already comes oldest-first).
  const newDates = !target
    ? []
    : target.kind === "date"
      ? chosen.map(() => target.date)
      : spreadDates(chosen.length, tomorrow, target.days);

  const summary = !target || chosen.length === 0
    ? null
    : target.kind === "date"
      ? `${chosen.length} ${chosen.length === 1 ? "task" : "tasks"} → ${formatEventDate(target.date)}`
      : `${chosen.length} ${chosen.length === 1 ? "task" : "tasks"} spread over ${formatEventDate(newDates[0])} – ${formatEventDate(newDates[newDates.length - 1])}`;

  const apply = () => {
    if (!target || chosen.length === 0) return;
    const updates = chosen.map((item, i) => ({ id: item.id, dueDate: newDates[i] }));
    startTransition(async () => {
      const count = await rescheduleTasks(updates);
      setMoved(count);
      setTarget(null);
    });
  };

  const close = () => {
    setOpen(false);
    setMoved(null);
    setSkipped(new Set());
    setTarget(null);
  };

  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-foreground/20 bg-surface px-4 py-3">
          <div className="min-w-[10rem] flex-1">
            <p className="text-sm font-medium">
              {items.length} {items.length === 1 ? "task is" : "tasks are"} past {items.length === 1 ? "its" : "their"} date
            </p>
            <p className="text-xs text-foreground/50">Give them new dates in one go. Nothing is lost.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-foreground/25 bg-background px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover"
          >
            Reschedule
          </button>
        </div>
      )}

      {open && (
        <Sheet title="Reschedule overdue tasks" subtitle="These dates have passed. Pick what to move, then when." onClose={close}>
          {moved !== null ? (
            <>
              <p className="text-sm font-medium">
                Moved {moved} {moved === 1 ? "task" : "tasks"}.
              </p>
              <button type="button" onClick={close} className="btn-primary self-start rounded px-3 py-1.5 text-sm">
                Done
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-foreground/55">
                <span>
                  {chosen.length} of {items.length} selected
                </span>
                <span className="flex gap-3">
                  <button type="button" className="link-hover" onClick={() => toggle(items.map((i) => i.id), true)}>
                    All
                  </button>
                  <button type="button" className="link-hover" onClick={() => toggle(items.map((i) => i.id), false)}>
                    None
                  </button>
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {groups.map((group) => {
                  const ids = group.items.map((i) => i.id);
                  const allOn = ids.every(isSelected);
                  return (
                    <div key={group.name} className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-xs font-medium text-foreground/60">
                        <input type="checkbox" checked={allOn} onChange={() => toggle(ids, !allOn)} className="h-3.5 w-3.5" />
                        {group.name}
                      </label>
                      <ul className="flex flex-col gap-1 pl-5">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <label className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-baseline gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected(item.id)}
                                  onChange={(e) => toggle([item.id], e.target.checked)}
                                  className="h-3.5 w-3.5 shrink-0 translate-y-0.5"
                                />
                                <span className="min-w-0">{item.title}</span>
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-foreground/40">
                                {daysBetween(item.due_date, today)}d late
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-2 border-t border-foreground/15 bg-background px-5 py-3">
                <p className="text-xs font-medium text-foreground/55">Move the selected to…</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickDates.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      className={chip(target?.kind === "date" && target.date === q.date)}
                      onClick={() => setTarget({ kind: "date", date: q.date })}
                    >
                      {q.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    min={today}
                    value={target?.kind === "date" && !quickDates.some((q) => q.date === target.date) ? target.date : ""}
                    onChange={(e) => e.target.value && setTarget({ kind: "date", date: e.target.value })}
                    aria-label="Pick another date"
                    className="rounded border border-foreground/20 bg-transparent px-2 py-0.5 text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-foreground/50">or spread over</span>
                  {[3, 5, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={chip(target?.kind === "spread" && target.days === d)}
                      onClick={() => setTarget({ kind: "spread", days: d })}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
                {summary && <p className="text-xs text-foreground/70">{summary}</p>}
                {target?.kind === "date" && chosen.length > 5 && (
                  <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
                    That’s a lot for one day. Spreading them out keeps it sustainable.
                  </p>
                )}
                <button
                  type="button"
                  disabled={isPending || !target || chosen.length === 0}
                  onClick={apply}
                  className="btn-primary self-start rounded px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {isPending ? "Moving…" : `Move ${chosen.length} ${chosen.length === 1 ? "task" : "tasks"}`}
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
