"use client";

import { useState } from "react";
import { HabitCalendarHeatmap } from "./HabitCalendarHeatmap";
import { areaColor } from "@/lib/area-colors";
import type { MonthlyCalendar } from "@/lib/habit-stats";

type HabitStat = {
  id: string;
  title: string;
  areaName: string | undefined;
  currentStreak: number;
  longestStreak: number;
  lifetimeCompleted: number;
  monthly: { completed: number; daysActive: number; rate: number };
  calendar: MonthlyCalendar;
};

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function HabitDetail({ habit, onBack }: { habit: HabitStat; onBack: () => void }) {
  const color = areaColor(habit.areaName).accent;

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <button type="button" onClick={onBack} className="link-hover self-start text-xs text-foreground/50">
        ← All habits
      </button>

      <div
        className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-surface p-5"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <div>
          <p className="text-lg font-semibold">{habit.title}</p>
          <p className="text-xs text-foreground/45">{habit.areaName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-hover p-3">
            <span className="text-xs text-foreground/45">This month</span>
            <span className="text-lg font-semibold tabular-nums">
              {habit.monthly.completed}/{habit.monthly.daysActive}
            </span>
            <span className="text-xs text-foreground/40">{formatPct(habit.monthly.rate)}</span>
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
            <span className="text-lg font-semibold tabular-nums">{habit.lifetimeCompleted}</span>
            <span className="text-xs text-foreground/40">completions</span>
          </div>
        </div>

        <HabitCalendarHeatmap calendar={habit.calendar} color={color} />
      </div>
    </div>
  );
}

export function HabitStatsView({
  habits,
  aggregate,
}: {
  habits: HabitStat[];
  aggregate: { avgRate: number; totalLifetime: number };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = habits.find((h) => h.id === selectedId);

  if (selected) {
    return <HabitDetail habit={selected} onBack={() => setSelectedId(null)} />;
  }

  if (habits.length === 0) {
    return (
      <p className="w-full max-w-md text-sm text-foreground/50">No habits yet.</p>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-xl border border-foreground/10 bg-surface p-4">
          <span className="text-xs uppercase tracking-wide text-foreground/45">Avg. this month</span>
          <span className="text-2xl font-semibold tabular-nums">{formatPct(aggregate.avgRate)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-foreground/10 bg-surface p-4">
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
              className="flex items-center justify-between rounded-xl border border-foreground/10 bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
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
    </div>
  );
}
