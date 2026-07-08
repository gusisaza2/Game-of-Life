"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeXpForCompletion } from "@/lib/xp-service";
import { checkAndApplyLevelUp } from "@/lib/level-up-service";
import { registerAreaActivity } from "@/lib/capacity-service";
import { getDateString } from "@/lib/today";

export async function toggleTaskCompletion(
  taskId: string,
  playerId: string,
  date: string,
  isCurrentlyCompleted: boolean,
) {
  const supabase = await createClient();

  if (isCurrentlyCompleted) {
    const { data: existingLog } = await supabase
      .from("task_logs")
      .select("xp_awarded")
      .eq("task_id", taskId)
      .eq("completed_date", date)
      .maybeSingle();

    await supabase
      .from("task_logs")
      .delete()
      .eq("task_id", taskId)
      .eq("completed_date", date);

    if (existingLog) {
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
  } else {
    const { data: player } = await supabase
      .from("players")
      .select("current_level, cumulative_xp, created_at")
      .eq("id", playerId)
      .single();
    const { data: task } = await supabase
      .from("tasks")
      .select("area_id")
      .eq("id", taskId)
      .single();
    if (!player || !task) {
      revalidatePath("/");
      return;
    }

    const { data: area } = await supabase
      .from("areas")
      .select("is_foundation")
      .eq("id", task.area_id)
      .single();
    if (!area) {
      revalidatePath("/");
      return;
    }

    const playerCreatedDate = getDateString(new Date(player.created_at));

    const completionXp = await computeXpForCompletion(playerId, taskId, date);
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
    });

    await supabase
      .from("players")
      .update({ cumulative_xp: Number(player.cumulative_xp) + completionXp + bonusXp })
      .eq("id", playerId);

    await checkAndApplyLevelUp(playerId);
  }

  revalidatePath("/");
}
