"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeXpForCompletion, type XpType } from "@/lib/xp-service";
import { computeNivelUp, type NivelUpEvent } from "@/lib/nivel-service";
import { registerAreaActivity } from "@/lib/capacity-service";
import { getDateString } from "@/lib/today";

export async function toggleTaskCompletion(
  taskId: string,
  playerId: string,
  date: string,
  isCurrentlyCompleted: boolean,
): Promise<{ xpAwarded: number; xpType: XpType; nivelUp: NivelUpEvent | null } | null> {
  const supabase = await createClient();

  if (isCurrentlyCompleted) {
    const { data: existingLog } = await supabase
      .from("task_logs")
      .select("xp_awarded, xp_type")
      .eq("task_id", taskId)
      .eq("completed_date", date)
      .maybeSingle();

    await supabase
      .from("task_logs")
      .delete()
      .eq("task_id", taskId)
      .eq("completed_date", date);

    // Bonus XP was never added to cumulative_xp, so only reverse Growth XP.
    // Nivel is never revoked once reached (same one-way logic as Chapter).
    if (existingLog && existingLog.xp_type === "growth") {
      const { data: player } = await supabase
        .from("players")
        .select("cumulative_xp")
        .eq("id", playerId)
        .single();
      if (player) {
        const newXp = Math.max(
          0,
          Number(player.cumulative_xp) - Number(existingLog.xp_awarded),
        );
        await supabase
          .from("players")
          .update({ cumulative_xp: newXp })
          .eq("id", playerId);
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
    .select("area_id")
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
  const bonusXp = await registerAreaActivity(
    playerId,
    task.area_id,
    area.is_foundation,
    player.current_level,
    date,
    playerCreatedDate,
  );

  await supabase.from("task_logs").insert({
    task_id: taskId,
    player_id: playerId,
    completed_date: date,
    xp_awarded: completionXp,
    xp_type: xpType,
  });

  // Bonus XP (same-day-created, non-exempt tasks) doesn't feed Growth-phase
  // leveling — only Growth XP and the (always-Growth) re-engagement bonus do.
  const growthXpEarned = (xpType === "growth" ? completionXp : 0) + bonusXp;
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
  return { xpAwarded: completionXp, xpType, nivelUp };
}
