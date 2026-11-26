"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHORES_ON_TODAY } from "@/lib/chores";

// Sets which chores hold Today's slots (up to CHORES_ON_TODAY): every other
// chore loses its pick. Only open chores can be picked. Choosing changes
// nothing else -- no XP, no dates.
export async function setTodayChores(ids: string[]): Promise<boolean> {
  const chosen = [...new Set(ids)];
  if (chosen.length > CHORES_ON_TODAY) return false;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ today_pick: null })
    .eq("tier", "chore")
    .not("today_pick", "is", null);
  if (error) return false;

  const base = Date.now();
  const results = await Promise.all(
    chosen.map((id, index) =>
      supabase
        .from("tasks")
        .update({ today_pick: new Date(base + index).toISOString() })
        .eq("id", id)
        .eq("tier", "chore")
        .is("done_date", null),
    ),
  );

  revalidatePath("/");
  return results.every((r) => !r.error);
}
