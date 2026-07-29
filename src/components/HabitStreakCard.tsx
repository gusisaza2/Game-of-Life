import { HabitStreakRing } from "./HabitStreakRing";
import { STREAK_GOAL_DAYS, nextStreakMilestoneAfter, xpForStreakMilestone } from "@/lib/habit-streak";
import { areaColor } from "@/lib/area-colors";

export function HabitStreakCard({
  title,
  areaName,
  currentStreak,
  longestStreak,
  areaDailyCeiling,
}: {
  title: string;
  areaName: string | undefined;
  currentStreak: number;
  longestStreak: number;
  areaDailyCeiling: number;
}) {
  const color = areaColor(areaName).accent;
  const next = nextStreakMilestoneAfter(currentStreak);
  const nextXp = xpForStreakMilestone(next.multiplier, areaDailyCeiling);

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 transition-colors hover:bg-foreground/[0.05]"
      style={{ color }}
    >
      <HabitStreakRing streak={currentStreak} color={color} />
      <div className="flex flex-col gap-0.5 text-foreground">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-foreground/50">
          {currentStreak === 1 ? "1 day" : `${currentStreak} days`}
          {currentStreak >= STREAK_GOAL_DAYS ? " · streak complete 🔥" : " in a row"}
          {longestStreak > currentStreak && ` · best ${longestStreak}`}
        </span>
        <span className="text-xs text-foreground/40">
          +{nextXp} XP at {next.day} days
        </span>
      </div>
    </div>
  );
}
