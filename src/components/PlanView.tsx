"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createBlock, deleteBlock, updateBlock } from "@/app/plan/actions";
import { useTaskCompletion } from "@/lib/use-task-completion";
import { areaColor } from "@/lib/area-colors";
import { Badge } from "@/components/Badge";
import { SectionHeading } from "@/components/SectionHeading";
import { compareByDeadline, deadlineLabel, deadlineStatus } from "@/lib/deadline";
import { eventDayLabel, formatEventDate } from "@/lib/events";
import {
  HEAVY_DAY_MINUTES,
  durationMinutes,
  endTimeFor,
  firstFreeStart,
  formatBlockRange,
  formatDuration,
  overlaps,
  plannedMinutes,
  type Slot,
} from "@/lib/time-blocks";

export type PlanTask = {
  id: string;
  title: string;
  tier: string;
  areaName?: string;
  dueDate: string | null;
  goalTitle: string | null;
  milestoneTitle: string | null;
  xp: number;
  areaDailyCap: number;
  investedMinutes: number;
  blocks: { id: string; start: string; end: string }[];
};

export type TimelineItem = {
  kind: "event" | "block";
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  status: string;
};

type SortMode = "due" | "goal" | "xp";

const DURATIONS = [30, 60, 90, 120, 180];
const NO_GOAL = "No goal";

const fieldClass = "rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm";

// Start time + duration for one block, used both to plan a new one and to
// edit an existing one. Suggests the first free spot of the day until the
// player picks a time themselves, and says so when it would overlap
// something (a warning, never a block).
function BlockForm({
  playerId,
  date,
  busy,
  busyTitles,
  taskId,
  block,
  onDone,
}: {
  playerId: string;
  date: string;
  busy: Slot[];
  busyTitles: string[];
  taskId?: string;
  block?: { id: string; start: string; end: string };
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [duration, setDuration] = useState(block ? durationMinutes(block.start, block.end) : 120);
  const [pickedStart, setPickedStart] = useState<string | null>(block ? block.start.slice(0, 5) : null);

  const suggestion = useMemo(() => firstFreeStart(busy, duration), [busy, duration]);
  const startTime = pickedStart ?? suggestion ?? "09:00";
  const endTime = endTimeFor(startTime, duration);

  const clash =
    endTime === null
      ? -1
      : busy.findIndex((slot) => overlaps(slot, { start: startTime, end: endTime }));

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          if (block) await updateBlock(formData);
          else await createBlock(formData);
          onDone();
        })
      }
      className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-2.5"
    >
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="blockDate" value={date} />
      <input type="hidden" name="durationMinutes" value={duration} />
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
      {block && <input type="hidden" name="blockId" value={block.id} />}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-foreground/60">
          Starts
          <input
            type="time"
            name="startTime"
            required
            value={startTime}
            onChange={(e) => setPickedStart(e.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setDuration(minutes)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                duration === minutes
                  ? "border-foreground/50 bg-foreground/10 font-medium"
                  : "border-foreground/20 text-foreground/60"
              }`}
            >
              {formatDuration(minutes)}
            </button>
          ))}
        </div>
      </div>

      {endTime === null && (
        <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
          That doesn’t fit in the day — pick an earlier start or a shorter block.
        </p>
      )}
      {clash >= 0 && (
        <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
          Overlaps with {busyTitles[clash]}. You can still save it.
        </p>
      )}
      {endTime && (
        <p className="text-xs text-foreground/45">{formatBlockRange(startTime, endTime)}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || endTime === null}
          className="btn-primary rounded px-3 py-1 text-sm disabled:opacity-60"
        >
          {block ? "Save" : "Add block"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="link-hover rounded px-3 py-1 text-sm text-foreground/60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TimelineRow({
  item,
  conflict,
  playerId,
  date,
  busyOthers,
}: {
  item: TimelineItem;
  conflict: boolean;
  playerId: string;
  date: string;
  busyOthers: { slots: Slot[]; titles: string[] };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isEditing && item.kind === "block") {
    return (
      <li>
        <BlockForm
          playerId={playerId}
          date={date}
          busy={busyOthers.slots}
          busyTitles={busyOthers.titles}
          block={{ id: item.id, start: item.start, end: item.end }}
          onDone={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-foreground/15 bg-surface px-3 py-2 text-sm">
      <div className="flex min-w-[140px] flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {item.title}
          <Badge tone={item.kind === "event" ? "neutral" : "balance"}>
            {item.kind === "event" ? "Event" : "Work block"}
          </Badge>
          {item.status === "done" && <Badge tone="muted">Done</Badge>}
          {conflict && <Badge tone="effort">Overlap</Badge>}
        </span>
        <span className="text-xs text-foreground/50">
          {formatBlockRange(item.start, item.end)}
          {item.location ? ` · ${item.location}` : ""}
        </span>
      </div>
      {item.kind === "block" && (
        <div className="flex shrink-0 gap-3 text-xs">
          <button type="button" onClick={() => setIsEditing(true)} className="link-hover text-foreground/60">
            Edit
          </button>
          <form action={(formData) => startTransition(() => deleteBlock(formData))}>
            <input type="hidden" name="blockId" value={item.id} />
            <button disabled={isPending} className="text-foreground/40 hover:text-red-500">
              Remove
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

function TaskRow({
  task,
  today,
  date,
  playerId,
  busy,
  busyTitles,
  showAreaCap,
}: {
  task: PlanTask;
  today: string;
  date: string;
  playerId: string;
  busy: Slot[];
  busyTitles: string[];
  showAreaCap: boolean;
}) {
  const [planning, setPlanning] = useState(false);
  const color = areaColor(task.areaName);
  const overdue = task.dueDate !== null && deadlineStatus(task.dueDate, today).kind === "overdue";

  return (
    <li className="flex flex-col gap-2">
      <div
        className="flex flex-col gap-1 rounded-xl border border-foreground/20 bg-surface py-2.5 pl-3 pr-3"
        style={{ borderLeft: `3px solid ${color.accent}` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="min-w-[140px] flex-1 text-sm text-foreground/90">{task.title}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {task.dueDate ? (
              <Badge tone={overdue ? "effort" : "neutral"}>{deadlineLabel(task.dueDate, today)}</Badge>
            ) : (
              <Badge tone="muted">No date</Badge>
            )}
          </span>
        </div>
        <p className="text-xs text-foreground/45">
          {task.tier === "main_task" ? "Misión" : "Chore"} · +{task.xp} XP
          {task.areaName ? ` · ${task.areaName}` : ""}
          {showAreaCap ? ` (about ${task.areaDailyCap} XP a day)` : ""}
          {task.goalTitle ? ` · ${task.goalTitle}` : ""}
        </p>
        {task.investedMinutes > 0 && (
          <p className="text-xs text-foreground/45">{formatDuration(task.investedMinutes)} invested so far</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {task.blocks.map((block) => (
            <span key={block.id} className="text-xs font-medium" style={{ color: "var(--accent-balance)" }}>
              Planned {formatBlockRange(block.start, block.end)}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setPlanning((v) => !v)}
            className="link-hover text-xs text-foreground/60"
          >
            {planning ? "Cancel" : task.blocks.length > 0 ? "+ Plan more time" : "Plan time"}
          </button>
        </div>
      </div>
      {planning && (
        <BlockForm
          playerId={playerId}
          date={date}
          busy={busy}
          busyTitles={busyTitles}
          taskId={task.id}
          onDone={() => setPlanning(false)}
        />
      )}
    </li>
  );
}

// Closes the evening ritual: completes the seeded "Planned tomorrow" habit.
function FinishPlanning({
  habit,
  playerId,
  today,
}: {
  habit: { id: string; done: boolean };
  playerId: string;
  today: string;
}) {
  const { isPending, flash, toggle, completed } = useTaskCompletion(
    habit.id,
    playerId,
    today,
    habit.done,
  );

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-foreground/20 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-foreground/70">
          {completed ? "Planning done for today ✓" : "Happy with the plan?"}
        </span>
        <div className="flex items-center gap-3">
          {flash && (
            <span className="xp-flash text-xs font-semibold tabular-nums" style={{ color: "var(--accent-effort)" }}>
              +{flash.xpAwarded} {flash.xpType === "bonus" ? "Bonus XP" : "XP"}
            </span>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={toggle}
            className={
              completed
                ? "link-hover text-xs text-foreground/60 disabled:opacity-50"
                : "btn-primary rounded px-3 py-1.5 text-sm disabled:opacity-60"
            }
          >
            {completed ? "Undo" : "Finish planning"}
          </button>
        </div>
      </div>
      {flash?.nivelUp && (
        <p className="xp-flash text-xs font-medium" style={{ color: "var(--accent-effort)" }}>
          ¡Nivel up! {flash.nivelUp.nivelReached} / {flash.nivelUp.totalNiveles}
        </p>
      )}
    </div>
  );
}

function sortTasks(tasks: PlanTask[], mode: SortMode): PlanTask[] {
  const byDue = (a: PlanTask, b: PlanTask) =>
    compareByDeadline({ due_date: a.dueDate, title: a.title }, { due_date: b.dueDate, title: b.title });
  const copy = [...tasks];
  if (mode === "xp") return copy.sort((a, b) => b.xp - a.xp || byDue(a, b));
  return copy.sort(byDue);
}

export function PlanView({
  playerId,
  today,
  date,
  prevDate,
  nextDate,
  tasks,
  timeline,
  planningHabit,
}: {
  playerId: string;
  today: string;
  date: string;
  prevDate: string | null;
  nextDate: string | null;
  tasks: PlanTask[];
  timeline: TimelineItem[];
  planningHabit: { id: string; done: boolean } | null;
}) {
  const [sort, setSort] = useState<SortMode>("due");

  // What's already on the day, as slots (events and live blocks).
  const live = timeline.filter((item) => item.status !== "skipped");
  const busy: Slot[] = live.map((item) => ({ start: item.start, end: item.end }));
  const busyTitles = live.map((item) => item.title);

  const conflicts = new Set(
    live
      .filter((item) =>
        live.some((other) => other.id !== item.id && overlaps(item, other)),
      )
      .map((item) => item.id),
  );

  const blocks = timeline.filter((item) => item.kind === "block");
  const totalMinutes = plannedMinutes(blocks);
  const heavy = totalMinutes > HEAVY_DAY_MINUTES;

  const sorted = sortTasks(tasks, sort);
  const groups: { heading: string | null; tasks: PlanTask[] }[] =
    sort === "goal"
      ? Array.from(
          sorted.reduce((map, task) => {
            const key = task.goalTitle ?? NO_GOAL;
            map.set(key, [...(map.get(key) ?? []), task]);
            return map;
          }, new Map<string, PlanTask[]>()),
        )
          .sort(([a], [b]) => (a === NO_GOAL ? 1 : b === NO_GOAL ? -1 : a.localeCompare(b)))
          .map(([heading, groupTasks]) => ({ heading, tasks: groupTasks }))
      : [{ heading: null, tasks: sorted }];

  // Busy slots seen by a block being edited exclude that block itself.
  function othersOf(id: string) {
    const rest = live.filter((item) => item.id !== id);
    return {
      slots: rest.map((item) => ({ start: item.start, end: item.end })),
      titles: rest.map((item) => item.title),
    };
  }

  const sortLabels: Record<SortMode, string> = { due: "Due date", goal: "Goal", xp: "XP" };

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        {prevDate ? (
          <Link
            href={`/plan?date=${prevDate}`}
            aria-label="Previous day"
            className="link-hover flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/20 text-sm text-foreground/60"
          >
            ←
          </Link>
        ) : (
          <span className="h-8 w-8" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium">{formatEventDate(date)}</p>
          <p className="text-xs text-foreground/45">{eventDayLabel(date, today)}</p>
        </div>
        {nextDate ? (
          <Link
            href={`/plan?date=${nextDate}`}
            aria-label="Next day"
            className="link-hover flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/20 text-sm text-foreground/60"
          >
            →
          </Link>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            The day
          </SectionHeading>
          <span className="text-xs tabular-nums text-foreground/45">
            {totalMinutes > 0 ? `${formatDuration(totalMinutes)} planned` : "Nothing planned yet"}
          </span>
        </div>
        {heavy && (
          <p
            className="rounded-lg px-3 py-2 text-xs"
            style={{
              color: "var(--accent-effort)",
              backgroundColor: "color-mix(in srgb, var(--accent-effort) 14%, transparent)",
            }}
          >
            Heavy day — {formatDuration(totalMinutes)} of work blocks. Leave some room to breathe.
          </p>
        )}
        {timeline.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {timeline.map((item) => (
              <TimelineRow
                key={`${item.kind}-${item.id}`}
                item={item}
                conflict={conflicts.has(item.id)}
                playerId={playerId}
                date={date}
                busyOthers={othersOf(item.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/45">
            No events or work blocks yet. Pick a task below and set aside some time for it.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            To plan <span className="text-foreground/35">({tasks.length})</span>
          </SectionHeading>
          <div className="flex gap-1.5">
            {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSort(mode)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  sort === mode
                    ? "border-foreground/50 bg-foreground/10 font-medium"
                    : "border-foreground/20 text-foreground/60"
                }`}
              >
                {sortLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        {tasks.length === 0 && (
          <p className="text-sm text-foreground/45">Nothing left to plan — every task is done.</p>
        )}

        {groups.map((group) => (
          <div key={group.heading ?? "all"} className="flex flex-col gap-2">
            {group.heading && <h3 className="text-xs text-foreground/60">{group.heading}</h3>}
            <ul className="flex flex-col gap-2">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  date={date}
                  playerId={playerId}
                  busy={busy}
                  busyTitles={busyTitles}
                  showAreaCap={sort === "xp"}
                />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {planningHabit && <FinishPlanning habit={planningHabit} playerId={playerId} today={today} />}
    </div>
  );
}
