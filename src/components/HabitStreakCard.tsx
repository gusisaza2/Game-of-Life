"use client";

import { HabitStreakRing } from "./HabitStreakRing";
import { STREAK_GOAL_DAYS, nextStreakMilestoneAfter, xpForStreakMilestone } from "@/lib/habit-streak";
import { areaColor } from "@/lib/area-colors";
import { useTaskCompletion } from "@/lib/use-task-completion";

// The streak ring *is* the completion control — no separate checkbox row.
// Clicking anywhere on the card toggles today's completion for this Habit,
// same server action and instant-feedback flash the plain checklist rows
// use, just laid out around the ring instead of a checkbox.
export function HabitStreakCard({
  taskId,
  title,
  areaName,
  currentStreak,
  longestStreak,
  areaDailyCeiling,
  completed,
  playerId,
  today,
  monthlyCompleted,
  monthlyDaysActive,
}: {
  taskId: string;
  title: string;
  areaName: string | undefined;
  currentStreak: number;
  longestStreak: number;
  areaDailyCeiling: number;
  completed: boolean;
  playerId: string;
  today: string;
  monthlyCompleted: number;
  monthlyDaysActive: number;
}) {
  const color = areaColor(areaName).accent;
  const next = nextStreakMilestoneAfter(currentStreak);
  const nextXp = xpForStreakMilestone(next.multiplier, areaDailyCeiling);
  const { isPending, flash, toggle } = useTaskCompletion(taskId, playerId, today, completed);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={completed}
        aria-label={completed ? `Mark ${title} incomplete` : `Mark ${title} complete`}
        style={{ color }}
        className="flex w-full items-center gap-3 rounded-xl border border-foreground/20 bg-surface p-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-70"
      >
        <div className="relative shrink-0">
          <HabitStreakRing streak={currentStreak} color={color} />
          {completed && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              ✓
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-sm font-medium ${completed ? "text-foreground/40 line-through" : "text-foreground"}`}
          >
            {title}
          </span>
          <span className="text-xs text-foreground/50">
            {currentStreak === 1 ? "1 day" : `${currentStreak} days`}
            {currentStreak >= STREAK_GOAL_DAYS ? " · streak complete 🔥" : " in a row"}
            {longestStreak > currentStreak && ` · best ${longestStreak}`}
          </span>
          {/* Stays visible (and non-zero) even when the streak just broke —
              a missed day shouldn't feel like the whole month reset too. */}
          <span className="text-xs text-foreground/40">
            {monthlyCompleted}/{monthlyDaysActive} this month
          </span>
          <span className="text-xs text-foreground/40">
            +{nextXp} XP at {next.day} days
          </span>
        </div>
        {flash && (
          <span
            className="xp-flash ml-auto shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: flash.xpType === "bonus" ? "var(--accent-effort)" : color }}
          >
            +{flash.xpAwarded} {flash.xpType === "bonus" ? "Bonus XP" : "XP"}
          </span>
        )}
      </button>
      {flash?.nivelUp && (
        <p className="xp-flash px-4 text-xs font-medium" style={{ color: "var(--accent-effort)" }}>
          ¡Nivel up! {flash.nivelUp.nivelReached} / {flash.nivelUp.totalNiveles}
        </p>
      )}
      {flash?.streakMilestone && (
        <p className="xp-flash px-4 text-xs font-medium" style={{ color }}>
          🔥 {flash.streakMilestone.day}-day streak! +{flash.streakMilestone.xpAwarded} XP
        </p>
      )}
    </div>
  );
}
