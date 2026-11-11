"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { areaColor } from "@/lib/area-colors";
import { Badge } from "@/components/Badge";
import { ItemSheet, ReschedulePanel, type AgendaItem } from "@/components/AgendaSheets";
import { layoutColumns } from "@/lib/agenda-layout";
import { eventDayLabel, formatEventDate, formatTime } from "@/lib/events";
import { useNow, type Now } from "@/lib/use-now";
import { moveBlock, moveEvent } from "@/app/agenda/actions";
import {
  HEAVY_DAY_MINUTES,
  durationMinutes,
  formatBlockRange,
  formatDuration,
  fromMinutes,
  overlaps,
  plannedMinutes,
  toMinutes,
} from "@/lib/time-blocks";

// One hour is this tall on the day timeline.
const PX_PER_MINUTE = 1;
const GUTTER_PX = 44;
const MIN_ITEM_HEIGHT = 30;

function minutesOf(time: string): number {
  return toMinutes(time);
}

// An item that has already finished (on a day before today, or earlier today).
function isPast(item: AgendaItem, now: Now): boolean {
  if (item.date < now.date) return true;
  if (item.date > now.date) return false;
  const start = minutesOf(item.start);
  const end = minutesOf(item.end);
  // Ending before it starts means it runs past midnight: still going.
  return end > start && end <= minutesOf(now.time);
}

// Dragging: snaps to 15 minutes. A mouse drags as soon as it moves; a finger
// has to press and hold first (~1/3 s) so ordinary scrolling still works.
const DRAG_STEP = 15;
const LONG_PRESS_MS = 320;
const MOVE_SLOP = 6;
const EDGE_PX = 70;

type DragRule = {
  // Earliest / latest start (minutes since midnight) the item may be dropped at.
  min: number;
  max: number;
  duration: number;
  rangeStart: number;
  // Longest it may be stretched to (from its current start).
  maxDuration: number;
  onDrop: (startMinutes: number) => void;
  onResize: (minutes: number) => void;
};

type Gesture = {
  type: string;
  // "move" drags the whole item; "resize" drags its bottom edge.
  mode: "move" | "resize";
  startY: number;
  startScroll: number;
  origin: number;
  lastClientY: number;
  active: boolean;
  preview: number;
  timer?: number;
  raf?: number;
  cleanup?: () => void;
};

function ItemBox({
  item,
  past,
  onOpen,
  style,
  drag,
}: {
  item: AgendaItem;
  past: boolean;
  onOpen: () => void;
  style: React.CSSProperties;
  drag: DragRule | null;
}) {
  const color = areaColor(item.areaName);
  const isEvent = item.kind === "event";
  const ref = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  // While dragging: the start (move) or the duration (resize) being previewed.
  const [preview, setPreview] = useState<{ mode: Gesture["mode"]; value: number } | null>(null);

  // Once a drag is on, the page must not scroll under the finger. React's own
  // touch handlers are passive, so this one is attached by hand.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  function update() {
    const g = gesture.current;
    if (!g || !drag) return;
    const delta = g.lastClientY + window.scrollY - (g.startY + g.startScroll);
    const snapped = Math.round((g.origin + delta) / DRAG_STEP) * DRAG_STEP;
    g.preview =
      g.mode === "resize"
        ? Math.max(DRAG_STEP, Math.min(drag.maxDuration, snapped))
        : Math.max(drag.min, Math.min(drag.max, snapped));
    setPreview({ mode: g.mode, value: g.preview });
  }

  function autoscroll() {
    const g = gesture.current;
    if (!g?.active) return;
    if (g.lastClientY < EDGE_PX) window.scrollBy(0, -10);
    else if (g.lastClientY > window.innerHeight - EDGE_PX) window.scrollBy(0, 10);
    update();
    g.raf = requestAnimationFrame(autoscroll);
  }

  function activate(pointerId: number) {
    const g = gesture.current;
    if (!g) return;
    g.active = true;
    try {
      ref.current?.setPointerCapture(pointerId);
    } catch {
      // Capture is a nicety; dragging still works without it.
    }
    // A drag must always be able to end: the release can land outside the
    // item (or the window), so watch for it on the window too, and let Escape
    // or losing focus cancel.
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    window.addEventListener("keydown", onKey);
    g.cleanup = () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      window.removeEventListener("keydown", onKey);
    };
    navigator.vibrate?.(10);
    setPreview({ mode: g.mode, value: g.origin });
    g.raf = requestAnimationFrame(autoscroll);
  }

  function finish(commit: boolean) {
    const g = gesture.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    if (g.raf) cancelAnimationFrame(g.raf);
    g.cleanup?.();
    if (g.active) {
      // The click that follows a drag's release must not open the sheet; if
      // none follows (touch), don't let the flag linger into the next tap.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (commit && drag && g.preview !== g.origin) {
        if (g.mode === "resize") drag.onResize(g.preview);
        else drag.onDrop(g.preview);
      }
    }
    gesture.current = null;
    setPreview(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const resize = (e.target as HTMLElement).dataset.handle === "resize";
    const origin = resize ? drag.duration : minutesOf(item.start);
    const g: Gesture = {
      type: e.pointerType,
      mode: resize ? "resize" : "move",
      startY: e.clientY,
      startScroll: window.scrollY,
      origin,
      lastClientY: e.clientY,
      active: false,
      preview: origin,
    };
    gesture.current = g;
    if (e.pointerType !== "mouse") {
      const id = e.pointerId;
      g.timer = window.setTimeout(() => activate(id), LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    g.lastClientY = e.clientY;
    // The button was released somewhere we never heard about: end the drag.
    if (g.active && g.type === "mouse" && e.buttons === 0) {
      finish(true);
      return;
    }
    if (!g.active) {
      if (Math.abs(e.clientY - g.startY) <= MOVE_SLOP) return;
      if (g.type === "mouse") activate(e.pointerId);
      else {
        // The finger moved before the hold finished: it's a scroll.
        window.clearTimeout(g.timer);
        gesture.current = null;
        return;
      }
    }
    update();
  }

  const dragging = preview !== null;
  const resizing = preview?.mode === "resize";
  const movingTo = preview && !resizing ? preview.value : null;
  const top = movingTo !== null && drag ? (movingTo - drag.rangeStart) * PX_PER_MINUTE : style.top;
  const height =
    resizing && drag && preview ? Math.max(MIN_ITEM_HEIGHT, preview.value * PX_PER_MINUTE - 2) : style.height;
  const rangeLabel =
    movingTo !== null && drag
      ? formatBlockRange(fromMinutes(movingTo), fromMinutes(movingTo + drag.duration))
      : resizing && preview
        ? formatBlockRange(item.start, fromMinutes(minutesOf(item.start) + preview.value))
        : formatBlockRange(item.start, item.end);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onOpen();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onContextMenu={(e) => {
        if (drag) e.preventDefault();
      }}
      className={`absolute overflow-hidden rounded-lg px-2 py-1 text-left ${
        drag ? "cursor-grab select-none [-webkit-touch-callout:none]" : ""
      } ${dragging ? "z-30 cursor-grabbing shadow-lg" : "transition-opacity hover:opacity-90"}`}
      style={{
        ...style,
        top,
        height,
        opacity: dragging ? 1 : past ? 0.5 : 1,
        backgroundColor: isEvent ? "var(--surface)" : color.soft,
        border: isEvent ? "1px solid color-mix(in srgb, var(--foreground) 22%, transparent)" : `1px dashed ${color.accent}`,
        borderLeft: `3px solid ${color.accent}`,
      }}
    >
      <span className={`block text-xs font-medium leading-tight ${item.status === "done" ? "line-through" : ""}`}>
        {item.title}
      </span>
      <span className="block text-[11px] leading-tight text-foreground/55">
        {isEvent ? "Event · " : "Work · "}
        {rangeLabel}
      </span>
      {drag && (
        // The bottom edge: drag it to change how long this lasts.
        <span
          data-handle="resize"
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex cursor-ns-resize items-end justify-center pb-1"
          // A fingertip needs room: up to 28px, but never more than ~45% of
          // a short item (the rest of it still moves the item).
          style={{ height: Math.max(14, Math.min(28, Number(style.height) * 0.45)) }}
        >
          <span className="h-1 w-10 rounded-full bg-foreground/35" />
        </span>
      )}
    </button>
  );
}

function DayTimeline({
  date,
  items,
  now,
  onOpen,
  onMove,
}: {
  date: string;
  items: AgendaItem[];
  now: Now;
  onOpen: (id: string) => void;
  onMove: (item: AgendaItem, startMinutes: number, minutes: number) => void;
}) {
  const dayItems = items.filter((i) => i.date === date);
  const starts = dayItems.map((i) => minutesOf(i.start));
  const ends = dayItems.map((i) => (minutesOf(i.end) > minutesOf(i.start) ? minutesOf(i.end) : 24 * 60));
  const firstHour = Math.min(7, Math.floor(Math.min(...starts, 7 * 60) / 60));
  const lastHour = Math.max(22, Math.ceil(Math.max(...ends, 22 * 60) / 60));
  const rangeStart = firstHour * 60;
  const height = (lastHour - firstHour) * 60 * PX_PER_MINUTE;

  const laidOut = layoutColumns(dayItems);
  const nowMinutes = minutesOf(now.time);
  const showNow = date === now.date && nowMinutes >= rangeStart && nowMinutes <= lastHour * 60;

  return (
    <div className="relative" style={{ height }}>
      {Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i).map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-foreground/10"
          style={{ top: (hour * 60 - rangeStart) * PX_PER_MINUTE }}
        >
          <span className="absolute -top-2 left-0 w-10 bg-background pr-1 text-right text-[10px] tabular-nums text-foreground/40">
            {hour === 24 ? "" : formatTime(`${String(hour).padStart(2, "0")}:00`).replace(":00", "")}
          </span>
        </div>
      ))}

      <div className="absolute bottom-0 top-0" style={{ left: GUTTER_PX, right: 0 }}>
        {laidOut.map((item) => {
          const start = minutesOf(item.start);
          const end = minutesOf(item.end) > start ? minutesOf(item.end) : 24 * 60;
          const width = 100 / item.cols;
          const duration = end - start;
          // Only what can sensibly be moved by hand: not the past, not what's
          // already done/finished, not something running past midnight.
          const movable =
            date >= now.date &&
            minutesOf(item.end) > start &&
            (item.kind === "block" ? item.status !== "done" : item.status === "scheduled");
          const max = Math.min(lastHour * 60, 24 * 60 - 1) - duration;
          const drag: DragRule | null =
            movable && max > rangeStart
              ? {
                  min: rangeStart,
                  max,
                  duration,
                  rangeStart,
                  maxDuration: Math.min(lastHour * 60, 24 * 60 - 1) - start,
                  onDrop: (m) => onMove(item, m, duration),
                  onResize: (minutes) => onMove(item, start, minutes),
                }
              : null;
          return (
            <ItemBox
              key={`${item.kind}-${item.id}`}
              item={item}
              past={isPast(item, now)}
              onOpen={() => onOpen(item.id)}
              drag={drag}
              style={{
                top: (start - rangeStart) * PX_PER_MINUTE,
                height: Math.max(MIN_ITEM_HEIGHT, (end - start) * PX_PER_MINUTE - 2),
                left: `calc(${item.col * width}% + 2px)`,
                width: `calc(${width}% - 4px)`,
              }}
            />
          );
        })}

        {showNow && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
            style={{ top: (nowMinutes - rangeStart) * PX_PER_MINUTE }}
          >
            <span className="h-2 w-2 -translate-x-1 rounded-full" style={{ backgroundColor: "var(--accent-effort)" }} />
            <span className="h-px flex-1" style={{ backgroundColor: "var(--accent-effort)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function WeekDayCard({
  date,
  items,
  now,
}: {
  date: string;
  items: AgendaItem[];
  now: Now;
}) {
  const dayItems = items
    .filter((i) => i.date === date)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  const blocks = dayItems.filter((i) => i.kind === "block");
  const total = plannedMinutes(blocks.map((b) => ({ start: b.start, end: b.end, status: b.status })));
  const heavy = total > HEAVY_DAY_MINUTES;
  const shown = dayItems.slice(0, 4);

  return (
    <Link
      href={`/agenda?date=${date}`}
      className={`flex flex-col gap-1.5 rounded-xl border bg-surface p-3 transition-colors hover:bg-surface-hover ${
        date === now.date ? "border-foreground/50" : "border-foreground/20"
      } ${date < now.date ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {formatEventDate(date)}
          <span className="ml-2 text-xs font-normal text-foreground/45">{eventDayLabel(date, now.date)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-foreground/50">
          {heavy && <Badge tone="effort">Heavy</Badge>}
          {total > 0 ? formatDuration(total) : dayItems.length === 0 ? "Free" : ""}
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {shown.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-baseline gap-2 text-xs text-foreground/70">
              <span className="w-[64px] shrink-0 tabular-nums text-foreground/45">{formatTime(item.start)}</span>
              <span className="min-w-0 truncate">
                {item.title}
                {item.kind === "event" && <span className="ml-1.5 text-foreground/40">· event</span>}
              </span>
            </li>
          ))}
          {dayItems.length > shown.length && (
            <li className="text-xs text-foreground/40">+{dayItems.length - shown.length} more</li>
          )}
        </ul>
      )}
    </Link>
  );
}

export function AgendaView({
  playerId,
  view,
  date,
  days,
  initialNow,
  items,
  prevHref,
  nextHref,
}: {
  playerId: string;
  view: "day" | "week";
  date: string;
  days: string[];
  initialNow: Now;
  items: AgendaItem[];
  prevHref: string;
  nextHref: string;
}) {
  // Follows the real clock while the page is open, so the "now" line, the
  // greyed-out past items and "Something came up" always start from the
  // actual moment, not from whenever the page was loaded.
  const now = useNow(initialNow);
  // The sheet keeps its own copy of the item: moving an event to another day
  // makes it vanish from the day being viewed, and the sheet still has to be
  // there to say which prep tasks that left late.
  const [open, setOpen] = useState<AgendaItem | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Dragging shows the new place at once; the server confirms (and the list
  // refreshes) right after. If it refuses, the item snaps back.
  const [shown, applyMove] = useOptimistic(
    items,
    (current, move: { id: string; kind: AgendaItem["kind"]; start: string; end: string }) =>
      current.map((i) =>
        i.id === move.id && i.kind === move.kind
          ? { ...i, start: move.start, end: move.end, status: i.kind === "block" ? "planned" : i.status }
          : i,
      ),
  );
  const [, startTransition] = useTransition();
  const [moveNote, setMoveNote] = useState<{ text: string; warn: boolean } | null>(null);

  function moveByDrag(item: AgendaItem, startMinutes: number, minutes: number) {
    const resized = minutes !== durationMinutes(item.start, item.end);
    const start = fromMinutes(startMinutes);
    const end = fromMinutes(startMinutes + minutes);
    const clash = items.find(
      (o) =>
        !(o.kind === item.kind && o.id === item.id) &&
        o.date === item.date &&
        o.status !== "skipped" &&
        overlaps({ start: o.start, end: o.end }, { start, end }),
    );
    startTransition(async () => {
      applyMove({ id: item.id, kind: item.kind, start, end });
      const ok =
        item.kind === "block"
          ? await moveBlock(item.id, item.date, start, minutes)
          : (await moveEvent(item.id, item.date, start, end)).ok;
      setMoveNote(
        !ok
          ? { text: "That didn’t move — try again.", warn: true }
          : clash
            ? { text: `${resized ? "Now ends" : "Moved to"} ${formatTime(resized ? end : start)}. It overlaps with ${clash.title}.`, warn: true }
            : { text: resized ? `Now lasts ${formatDuration(minutes)}.` : `Moved to ${formatTime(start)}.`, warn: false },
      );
    });
  }

  const dayLabel = view === "day" ? formatEventDate(date) : `${formatEventDate(days[0])} – ${formatEventDate(days[6])}`;
  const canReschedule = view === "day" && date >= now.date;

  const navClass =
    "link-hover flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/20 text-sm text-foreground/60";
  const tabClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? "border-foreground/50 bg-foreground/10 font-medium" : "border-foreground/20 text-foreground/60"
    }`;

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Link href={`/agenda?view=day&date=${view === "day" ? date : now.date}`} className={tabClass(view === "day")}>
            Day
          </Link>
          <Link href={`/agenda?view=week&date=${date}`} className={tabClass(view === "week")}>
            Week
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground/50">
          <span className="tabular-nums">Now {formatTime(now.time)}</span>
          {date !== now.date && view === "day" && (
            <Link href="/agenda" className="link-hover">
              Today
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={prevHref} aria-label={view === "day" ? "Previous day" : "Previous week"} className={navClass}>
          ←
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium">{dayLabel}</p>
          {view === "day" && <p className="text-xs text-foreground/45">{eventDayLabel(date, now.date)}</p>}
        </div>
        <Link href={nextHref} aria-label={view === "day" ? "Next day" : "Next week"} className={navClass}>
          →
        </Link>
      </div>

      {canReschedule && (
        <button
          type="button"
          onClick={() => setRescheduling(true)}
          className="self-start rounded-lg border border-foreground/25 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover"
        >
          Something came up
        </button>
      )}

      {view === "day" ? (
        <>
          {canReschedule && (
            <p className="text-xs text-foreground/45">
              Drag an item to move it, or its bottom edge to change how long it lasts. On a phone, press and hold first.
            </p>
          )}
          {moveNote && (
            <p
              role="status"
              className="text-xs"
              style={moveNote.warn ? { color: "var(--accent-effort)" } : undefined}
            >
              {moveNote.text}
            </p>
          )}
          <DayTimeline
            date={date}
            items={shown}
            now={now}
            onOpen={(id) => setOpen(shown.find((i) => i.id === id) ?? null)}
            onMove={moveByDrag}
          />
          {items.filter((i) => i.date === date).length === 0 && (
            <p className="text-sm text-foreground/45">
              Nothing scheduled this day. Plan some work from the Plan page.
            </p>
          )}
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {days.map((day) => (
            <li key={day}>
              <WeekDayCard date={day} items={items} now={now} />
            </li>
          ))}
        </ul>
      )}

      {open && (
        <ItemSheet
          item={open}
          items={items}
          playerId={playerId}
          today={now.date}
          now={now.time}
          onClose={() => setOpen(null)}
        />
      )}
      {rescheduling && (
        <ReschedulePanel
          playerId={playerId}
          date={date}
          today={now.date}
          now={now.time}
          onClose={() => setRescheduling(false)}
          onEditEvent={(eventId) => {
            setRescheduling(false);
            setOpen(items.find((i) => i.id === eventId) ?? null);
          }}
        />
      )}
    </div>
  );
}
