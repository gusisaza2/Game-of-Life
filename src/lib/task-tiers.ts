// "main_task" keeps its original name at the data layer (matches the
// Level->Chapter pattern: rename the label, not the identifier) --
// player-facing copy calls it "Misión" instead.
export const TIER_LABELS: Record<string, string> = {
  habit: "Habit",
  main_task: "Misión",
  chore: "Chore",
};
