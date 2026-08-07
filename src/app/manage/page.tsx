import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoalsSection } from "@/components/manage/GoalsSection";
import { TaskForm } from "@/components/manage/TaskForm";
import { TaskRow } from "@/components/manage/TaskRow";
import { activateScheduledTasks } from "@/lib/scheduled-activation-service";
import { getTodayDateString } from "@/lib/today";
import { TIER_LABELS } from "@/lib/task-tiers";
import { SectionHeading } from "@/components/SectionHeading";

export default async function ManagePage() {
  const supabase = await createClient();

  const { data: player } = await supabase.from("players").select("id").single();
  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  await activateScheduledTasks(player.id, getTodayDateString());

  const [
    { data: areas },
    { data: goals },
    { data: tasks },
    { data: milestoneRows },
    { data: allMilestoneRows },
  ] = await Promise.all([
    supabase.from("areas").select("id, name").order("name"),
    supabase
      .from("goals")
      .select("id, title, status, area_id, milestones(id, title, order_index, status)")
      .eq("player_id", player.id)
      .order("created_at"),
    supabase
      .from("tasks")
      .select(
        "id, title, tier, area_id, recurrence, is_active, milestone_id, scheduled_activation_date",
      )
      .eq("player_id", player.id)
      .order("title"),
    supabase
      .from("milestones")
      .select("id, title, goals!inner(title, status)")
      .eq("status", "active")
      .eq("goals.status", "active"),
    supabase.from("milestones").select("id, title, goals(title)"),
  ]);

  const milestoneOptions = (milestoneRows ?? []).map((m) => ({
    id: m.id,
    label: `${(m.goals as unknown as { title: string }).title} → ${m.title}`,
  }));
  const milestoneLabelsById = new Map(
    (allMilestoneRows ?? []).map((m) => [
      m.id,
      `${(m.goals as unknown as { title: string }).title} → ${m.title}`,
    ]),
  );

  // Milestone-linked tasks are shown nested under their Milestone instead
  // of the flat Tasks list below, so "everything left to do for this
  // Milestone" (active or still-planned) reads as one group.
  const standaloneTasks = (tasks ?? []).filter((t) => !t.milestone_id);
  const tasksByMilestoneId = new Map<string, NonNullable<typeof tasks>>();
  for (const task of tasks ?? []) {
    if (!task.milestone_id) continue;
    const list = tasksByMilestoneId.get(task.milestone_id) ?? [];
    list.push(task);
    tasksByMilestoneId.set(task.milestone_id, list);
  }

  // Guarantee a task's current milestone link survives into its edit
  // form's options, even if that Goal is no longer active.
  function milestoneOptionsFor(task: { milestone_id: string | null }) {
    if (!task.milestone_id || milestoneOptions.some((m) => m.id === task.milestone_id)) {
      return milestoneOptions;
    }
    return [
      ...milestoneOptions,
      {
        id: task.milestone_id,
        label: milestoneLabelsById.get(task.milestone_id) ?? "Linked milestone",
      },
    ];
  }

  const tasksByTier = {
    habit: standaloneTasks.filter((t) => t.tier === "habit"),
    main_task: standaloneTasks.filter((t) => t.tier === "main_task"),
    chore: standaloneTasks.filter((t) => t.tier === "chore"),
  };

  return (
    <main className="flex-1 flex flex-col items-center gap-10 p-8 sm:p-16">
      <header className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Manage</h1>
        <Link href="/" className="link-hover text-sm text-foreground/60">
          ← Today
        </Link>
      </header>

      <GoalsSection
        goals={goals ?? []}
        areas={areas ?? []}
        playerId={player.id}
        tasksByMilestoneId={tasksByMilestoneId}
        milestoneOptions={milestoneOptions}
        milestoneLabelsById={milestoneLabelsById}
      />

      <section className="w-full max-w-md flex flex-col gap-3">
        <SectionHeading>Tasks</SectionHeading>

        {(["habit", "main_task", "chore"] as const).map((tier) => (
          <div key={tier} className="flex flex-col gap-2">
            <h3 className="text-xs text-foreground/60">{TIER_LABELS[tier]}</h3>
            <ul className="flex flex-col gap-1">
              {tasksByTier[tier].map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  areas={areas ?? []}
                  milestoneOptions={milestoneOptionsFor(task)}
                  milestoneLabel={null}
                />
              ))}
            </ul>
          </div>
        ))}

        <TaskForm playerId={player.id} areas={areas ?? []} milestoneOptions={milestoneOptions} />
      </section>
    </main>
  );
}
