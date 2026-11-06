import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoalsSection } from "@/components/manage/GoalsSection";
import { TaskForm } from "@/components/manage/TaskForm";
import { TaskRow } from "@/components/manage/TaskRow";
import { DeadlinePanel } from "@/components/manage/DeadlinePanel";
import { EventForm } from "@/components/manage/EventForm";
import { EventRow, type ManageEvent } from "@/components/manage/EventRow";
import { EventsProvider } from "@/components/manage/EventsContext";
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

  // activateScheduledTasks doesn't depend on (or get depended on by) any
  // of the reads below -- run it alongside them instead of before them.
  const [
    ,
    { data: areas },
    { data: goals },
    { data: tasks },
    { data: milestoneRows },
    { data: allMilestoneRows },
    { data: eventRows },
  ] = await Promise.all([
    activateScheduledTasks(player.id, getTodayDateString()),
    supabase.from("areas").select("id, name").order("name"),
    supabase
      .from("goals")
      .select("id, title, status, area_id, milestones(id, title, order_index, status)")
      .eq("player_id", player.id)
      .order("created_at"),
    supabase
      .from("tasks")
      .select(
        "id, title, tier, area_id, recurrence, is_active, milestone_id, scheduled_activation_date, due_date, done_date, event_id",
      )
      .eq("player_id", player.id)
      .order("title"),
    supabase
      .from("milestones")
      .select("id, title, goals!inner(title, status)")
      .eq("status", "active")
      .eq("goals.status", "active"),
    supabase.from("milestones").select("id, title, goals(title)"),
    supabase
      .from("events")
      .select("id, title, area_id, milestone_id, event_date, start_time, end_time, location, status")
      .eq("player_id", player.id)
      .order("event_date")
      .order("start_time"),
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

  // One-off tasks still waiting for a deadline (finished ones don't need one).
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name as string]));
  const undatedTasks = (tasks ?? [])
    .filter((t) => t.tier !== "habit" && !t.due_date && !t.done_date)
    .map((t) => ({ id: t.id, title: t.title, tier: t.tier, areaName: areaNameById.get(t.area_id) }));

  const events = (eventRows ?? []) as ManageEvent[];
  // Events under a Milestone are shown with it (see MilestoneRow); only the
  // ones that stand alone are listed in the Events section below.
  const standaloneEvents = events.filter((e) => !e.milestone_id);
  const upcomingStandalone = standaloneEvents.filter((e) => e.status === "scheduled");
  const pastStandalone = standaloneEvents.filter((e) => e.status !== "scheduled");

  const tasksByTier = {
    habit: standaloneTasks.filter((t) => t.tier === "habit"),
    main_task: standaloneTasks.filter((t) => t.tier === "main_task"),
    chore: standaloneTasks.filter((t) => t.tier === "chore"),
  };

  return (
    <EventsProvider events={events}>
    <main className="flex-1 flex flex-col items-center gap-10 p-8 sm:p-16">
      <header className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Manage</h1>
        <Link href="/" className="link-hover text-sm text-foreground/60">
          ← Today
        </Link>
      </header>

      <DeadlinePanel tasks={undatedTasks} />

      <GoalsSection
        goals={goals ?? []}
        areas={areas ?? []}
        playerId={player.id}
        tasksByMilestoneId={tasksByMilestoneId}
        milestoneOptions={milestoneOptions}
        milestoneLabelsById={milestoneLabelsById}
      />

      <section className="w-full max-w-md flex flex-col gap-3">
        <SectionHeading>Events</SectionHeading>
        <p className="text-xs text-foreground/50">
          Things that happen at a set time and can’t be done early. Events that belong to a Goal
          are listed under their Milestone above.
        </p>
        <ul className="flex flex-col gap-1">
          {upcomingStandalone.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              areas={areas ?? []}
              milestoneOptions={milestoneOptions}
              playerId={player.id}
              milestoneLabel={null}
            />
          ))}
        </ul>
        {pastStandalone.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-foreground/50">
              Past events ({pastStandalone.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {pastStandalone.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  areas={areas ?? []}
                  milestoneOptions={milestoneOptions}
                  playerId={player.id}
                  milestoneLabel={null}
                />
              ))}
            </ul>
          </details>
        )}
        <EventForm
          playerId={player.id}
          areas={areas ?? []}
          milestoneOptions={milestoneOptions}
        />
      </section>

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
    </EventsProvider>
  );
}
