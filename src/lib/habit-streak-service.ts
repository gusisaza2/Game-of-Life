import { createClient } from "@/lib/supabase/server";

function daysBetween(earlierDate: string, laterDate: string): number {
  const a = new Date(`${earlierDate}T00:00:00`);
  const b = new Date(`${laterDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// A missed day breaks a Habit's streak with no grace period (design
// discussion: this was a deliberate choice, distinct from AreaCapacity's
// decay which does have a grace window). Computed on-read, same pattern
// as decay/Good Day backfill — no cron — so a broken streak shows as
// broken the moment the player opens the app, even before they've
// completed (or not) anything today.
export async function refreshHabitStreaks(playerId: string, today: string): Promise<void> {
  const supabase = await createClient();

  const { data: habits } = await supabase
    .from("tasks")
    .select("id, current_streak, longest_streak, last_streak_date")
    .eq("player_id", playerId)
    .eq("tier", "habit")
    .eq("is_active", true);

  for (const habit of habits ?? []) {
    if (!habit.last_streak_date) continue;
    if (daysBetween(habit.last_streak_date, today) <= 1) continue;

    await supabase
      .from("tasks")
      .update({
        current_streak: 0,
        longest_streak: Math.max(habit.longest_streak, habit.current_streak),
        last_streak_milestone_reached: 0,
      })
      .eq("id", habit.id);
  }
}
