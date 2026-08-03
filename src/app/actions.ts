"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeXpForCompletion, type XpType } from "@/lib/xp-service";
import { computeNivelUp, type NivelUpEvent } from "@/lib/nivel-service";
import { registerAreaActivity, restoreAreaActivity } from "@/lib/capacity-service";
import { perAreaDailyXpCeiling } from "@/lib/leveling";
import { streakMilestoneAt, xpForStreakMilestone } from "@/lib/habit-streak";
import { getDateString, daysBetween } from "@/lib/today";

export type StreakMilestoneEvent = { day: number; xpAwarded: number };

export async function toggleTaskCompletion(
  taskId: string,
  playerId: string,
  date: string,
  isCurrentlyCompleted: boolean,
): Promise<{
  xpAwarded: number;
  xpType: XpType;
  nivelUp: NivelUpEvent | null;
  streakMilestone: StreakMilestoneEvent | null;
} | null> {
  const supabase = await createClient();

  if (isCurrentlyCompleted) {
    const { data: existingLog } = await supabase
      .from("task_logs")
      .select(
        "xp_awarded, xp_type, reengagement_bonus_xp, prev_area_capacity, prev_area_last_activity_date, prev_area_decay_cycle_start_date, streak_xp_awarded, prev_current_streak, prev_longest_streak, prev_last_streak_date, prev_last_streak_milestone_reached",
      )
      .eq("task_id", taskId)
      .eq("completed_date", date)
      .maybeSingle();

    await supabase
      .from("task_logs")
      .delete()
      .eq("task_id", taskId)
      .eq("completed_date", date);

    if (existingLog) {
      // Bonus XP (Task Activation Delay's same-day type) was never added to
      // cumulative_xp, so only the tier XP (if Growth) needs reversing --
      // but the re-engagement bonus (formula #6) and Habit Streak milestone
      // XP *are* always Growth XP, so both must be reversed too, or they
      // stay stuck forever (the bug this pattern already fixed once).
      // Nivel is never revoked once reached (same one-way logic as
      // Chapter) -- untouched here.
      const growthToReverse =
        (existingLog.xp_type === "growth" ? Number(existingLog.xp_awarded) : 0) +
        Number(existingLog.reengagement_bonus_xp) +
        Number(existingLog.streak_xp_awarded);

      if (growthToReverse > 0) {
        const { data: player } = await supabase
          .from("players")
          .select("cumulative_xp")
          .eq("id", playerId)
          .single();
        if (player) {
          const newXp = Math.max(0, Number(player.cumulative_xp) - growthToReverse);
          await supabase.from("players").update({ cumulative_xp: newXp }).eq("id", playerId);
        }
      }

      // Every completion resets the area's decay clock (AreaCapacity), not
      // just bonus-triggering ones -- restore that too, guarded so it
      // can't clobber real activity that happened in this area since.
      // (prev_area_capacity is null only for logs written before this
      // snapshot existed -- nothing to restore for those.)
      if (existingLog.prev_area_capacity !== null) {
        const { data: task } = await supabase
          .from("tasks")
          .select("area_id")
          .eq("id", taskId)
          .single();
        if (task) {
          await restoreAreaActivity(playerId, task.area_id, date, {
            prevCapacity: Number(existingLog.prev_area_capacity),
            prevLastActivityDate: existingLog.prev_area_last_activity_date,
            prevDecayCycleStartDate: existingLog.prev_area_decay_cycle_start_date,
          });
        }
      }

      // Same idea for Habit Streak state -- restore it, guarded so it only
      // applies if nothing has touched the streak since this completion
      // (a Habit can only be completed once per day, so in practice this
      // is always safe, but the guard costs nothing).
      if (existingLog.prev_current_streak !== null) {
        await supabase
          .from("tasks")
          .update({
            current_streak: existingLog.prev_current_streak,
            longest_streak: existingLog.prev_longest_streak,
            last_streak_date: existingLog.prev_last_streak_date,
            last_streak_milestone_reached: existingLog.prev_last_streak_milestone_reached,
          })
          .eq("id", taskId)
          .eq("last_streak_date", date);
      }
    }

    revalidatePath("/");
    return null;
  }

  const { data: player } = await supabase
    .from("players")
    .select("current_level, cumulative_xp, created_at, last_nivel_reached")
    .eq("id", playerId)
    .single();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "area_id, tier, current_streak, longest_streak, last_streak_date, last_streak_milestone_reached",
    )
    .eq("id", taskId)
    .single();
  if (!player || !task) {
    revalidatePath("/");
    return null;
  }

  const { data: area } = await supabase
    .from("areas")
    .select("is_foundation")
    .eq("id", task.area_id)
    .single();
  if (!area) {
    revalidatePath("/");
    return null;
  }

  const playerCreatedDate = getDateString(new Date(player.created_at));

  const { xpAwarded: completionXp, xpType } = await computeXpForCompletion(
    playerId,
    taskId,
    date,
  );
  const activity = await registerAreaActivity(
    playerId,
    task.area_id,
    area.is_foundation,
    player.current_level,
    date,
    playerCreatedDate,
  );
  const bonusXp = activity?.bonusXp ?? 0;

  // Habit Streak: consecutive-day tracking per Habit, independent of Good
  // Days/Tasks. Only tier === "habit" tasks carry a streak. A day is
  // "consecutive" if the last completion was exactly yesterday; anything
  // else (first ever, or a gap that refreshHabitStreaks hasn't caught yet)
  // starts a fresh streak at 1 -- there's no grace period by design.
  let streakMilestone: StreakMilestoneEvent | null = null;
  let streakXp = 0;
  const streakSnapshot =
    task.tier === "habit"
      ? {
          prev_current_streak: task.current_streak,
          prev_longest_streak: task.longest_streak,
          prev_last_streak_date: task.last_streak_date,
          prev_last_streak_milestone_reached: task.last_streak_milestone_reached,
        }
      : null;

  if (task.tier === "habit") {
    const isConsecutive =
      task.last_streak_date !== null && daysBetween(task.last_streak_date, date) === 1;
    const newCurrentStreak = isConsecutive ? task.current_streak + 1 : 1;
    const newLongestStreak = Math.max(task.longest_streak, newCurrentStreak);

    const milestone = streakMilestoneAt(newCurrentStreak);
    const crossedNewMilestone = milestone && newCurrentStreak > task.last_streak_milestone_reached;

    if (crossedNewMilestone && milestone) {
      const ceiling = perAreaDailyXpCeiling(player.current_level, area.is_foundation);
      streakXp = xpForStreakMilestone(milestone.multiplier, ceiling);
      streakMilestone = { day: milestone.day, xpAwarded: streakXp };
    }

    await supabase
      .from("tasks")
      .update({
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_streak_date: date,
        last_streak_milestone_reached: crossedNewMilestone
          ? newCurrentStreak
          : task.last_streak_milestone_reached,
      })
      .eq("id", taskId);
  }

  await supabase.from("task_logs").insert({
    task_id: taskId,
    player_id: playerId,
    completed_date: date,
    xp_awarded: completionXp,
    xp_type: xpType,
    reengagement_bonus_xp: bonusXp,
    prev_area_capacity: activity?.prevCapacity ?? null,
    prev_area_last_activity_date: activity?.prevLastActivityDate ?? null,
    prev_area_decay_cycle_start_date: activity?.prevDecayCycleStartDate ?? null,
    streak_xp_awarded: streakXp,
    ...streakSnapshot,
  });

  // Bonus XP (same-day-created, non-exempt tasks) doesn't feed Growth-phase
  // leveling — only Growth XP, the (always-Growth) re-engagement bonus, and
  // Habit Streak milestone XP do.
  const growthXpEarned = (xpType === "growth" ? completionXp : 0) + bonusXp + streakXp;
  let nivelUp: NivelUpEvent | null = null;

  if (growthXpEarned > 0) {
    const newCumulativeXp = Number(player.cumulative_xp) + growthXpEarned;

    // Nivel is XP-driven (design doc Section 7.5, revised) — checked here,
    // in real time, since XP (unlike Good Days) is awarded immediately.
    // Chapter advancement itself no longer reacts to XP changes (it's
    // Good-Day-only now, checked in good-day-service.ts's backfill), so
    // player.current_level can't have changed underneath this action.
    const { lastNivelReached, event } = computeNivelUp({
      current_level: player.current_level,
      cumulative_xp: newCumulativeXp,
      last_nivel_reached: player.last_nivel_reached,
    });
    nivelUp = event;

    await supabase
      .from("players")
      .update({ cumulative_xp: newCumulativeXp, last_nivel_reached: lastNivelReached })
      .eq("id", playerId);
  }

  revalidatePath("/");
  return { xpAwarded: completionXp, xpType, nivelUp, streakMilestone };
}
