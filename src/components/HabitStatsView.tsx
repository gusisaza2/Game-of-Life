"use client";

import { useState } from "react";
import { HabitCalendarHeatmap } from "./HabitCalendarHeatmap";
import { HabitHistory } from "./HabitHistory";
import { areaColor } from "@/lib/area-colors";
import {
  buildMonthlyCalendar,
  monthLabelFor,
  shiftMonthKey,
  statsForMonth,
  type MonthlyStats,
} from "@/lib/habit-stats";

type HabitStat = {
  id: string;
  title: string;
  areaName: string | undefined;
  currentStreak: number;
  longestStreak: number;
  activatedDate: string;
  completedDates: string[]; // every completion, all time, ascending
  monthly: MonthlyStats; // the current month, for the list view
};

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function MonthArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous month" : "Next month"}
      className="link-hover flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/20 text-sm text-foreground/60 disabled:opacity-25 disabled:hover:text-foreground/60"
    >
      {direction === "prev" ? "←" : "→"}
    </button>
  );
}

function HabitDetail({
  habit,
  today,
  onBack,
}: {
  habit: HabitStat;
  today: string;
  onBack: () => void;
}) {
  const color = areaColor(habit.areaName).accent;
  const currentKey = today.slice(0, 7);
  const [monthKey, setMonthKey] = useState(currentKey);

  // Can't browse before the habit's first month, or past this one.
  const earliestKey = habit.activatedDate.slice(0, 7);
  const isCurrent = monthKey === currentKey;
  const monthStats = statsForMonth(habit.activatedDate, today, monthKey, habit.completedDates);
  const [year, month] = monthKey.split("-").map(Number);
  const calendar = buildMonthlyCalendar(
    year,
    month,
    habit.activatedDate,
    today,
    new Set(habit.completedDates.filter((d) => d.startsWith(monthKey))),
  );

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <button type="button" onClick={onBack} className="link-hover self-start text-xs text-foreground/50">
        ← All habits
      </button>

      <div
        className="flex flex-col gap-4 rounded-2xl border border-foreground/20 bg-surface p-5"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <div>
          <p className="text-lg font-semibold">{habit.title}</p>
          <p className="text-xs text-foreground/45">{habit.areaName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-hover p-3">
            <span className="text-xs text-foreground/45">
              {isCurrent ? "This month" : monthLabelFor(monthKey)}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {monthStats.completed}/{monthStats.daysActive}
            </span>
            <span className="text-xs text-foreground/40">{formatPct(monthStats.rate)}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-hover p-3">
            <span className="text-xs text-foreground/45">Current streak</span>
            <span className="text-lg font-semibold tabular-nums">{habit.currentStreak}</span>
            <span className="text-xs text-foreground/40">days</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-hover p-3">
            <span className="text-xs text-foreground/45">Best streak</span>
            <span className="text-lg font-semibold tabular-nums">
              {Math.max(habit.longestStreak, habit.currentStreak)}
            </span>
            <span className="text-xs text-foreground/40">days</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-hover p-3">
            <span className="text-xs text-foreground/45">All time</span>
            <span className="text-lg font-semibold tabular-nums">{habit.completedDates.length}</span>
            <span className="text-xs text-foreground/40">completions</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <MonthArrow
            direction="prev"
            disabled={monthKey <= earliestKey}
            onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
          />
          <p className="text-sm font-medium">{monthLabelFor(monthKey)}</p>
          <MonthArrow
            direction="next"
            disabled={isCurrent}
            onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
          />
        </div>

        <HabitCalendarHeatmap calendar={calendar} color={color} showLabel={false} />
      </div>
    </div>
  );
}

export function HabitStatsView({
  habits,
  aggregate,
  today,
}: {
  habits: HabitStat[];
  aggregate: { avgRate: number; totalLifetime: number };
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = habits.find((h) => h.id === selectedId);

  if (selected) {
    return <HabitDetail habit={selected} today={today} onBack={() => setSelectedId(null)} />;
  }

  if (habits.length === 0) {
    return (
      <p className="w-full max-w-md text-sm text-foreground/50">No habits yet.</p>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-xl border border-foreground/20 bg-surface p-4">
          <span className="text-xs uppercase tracking-wide text-foreground/45">Avg. this month</span>
          <span className="text-2xl font-semibold tabular-nums">{formatPct(aggregate.avgRate)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-foreground/20 bg-surface p-4">
          <span className="text-xs uppercase tracking-wide text-foreground/45">All-time total</span>
          <span className="text-2xl font-semibold tabular-nums">{aggregate.totalLifetime}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {habits.map((habit) => {
          const color = areaColor(habit.areaName).accent;
          return (
            <button
              key={habit.id}
              type="button"
              onClick={() => setSelectedId(habit.id)}
              style={{ borderLeft: `3px solid ${color}` }}
              className="flex items-center justify-between rounded-xl border border-foreground/20 bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{habit.title}</span>
                <span className="text-xs text-foreground/45">
                  {habit.monthly.completed}/{habit.monthly.daysActive} this month ·{" "}
                  {formatPct(habit.monthly.rate)}
                </span>
              </div>
              <span className="link-hover text-xs text-foreground/40">View →</span>
            </button>
          );
        })}
      </div>

      <HabitHistory habits={habits} today={today} />

      <div className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
          Export
        </span>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href="/api/export?dataset=completions" download className="link-hover text-foreground/60">
            Every completion
          </a>
          <a href="/api/export?dataset=good-days" download className="link-hover text-foreground/60">
            Good Days by day
          </a>
          <a href="/api/export?dataset=full" download className="link-hover text-foreground/60">
            Full backup (JSON)
          </a>
        </div>
      </div>
    </div>
  );
}
