import { createClient } from "@/lib/supabase/server";

// "Activate tomorrow" — a planned Task can carry a
// scheduled_activation_date instead of requiring an immediate manual
// Reactivate. This flips it on the next time the player opens the app on
// or after that date (on-read, same pattern as decay/Good Day backfill —
// no cron). activated_at is set to the moment this actually runs, so the
// Task Activation Delay (CLAUDE.md #9) still applies from whatever day it
// truly goes live, not the day it was scheduled.
export async function activateScheduledTasks(playerId: string, today: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
      scheduled_activation_date: null,
    })
    .eq("player_id", playerId)
    .eq("is_active", false)
    .not("scheduled_activation_date", "is", null)
    .lte("scheduled_activation_date", today);
}
