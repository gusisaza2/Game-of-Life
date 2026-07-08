import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoalForm } from "@/components/manage/GoalForm";
import { MilestoneForm } from "@/components/manage/MilestoneForm";
import { TaskForm } from "@/components/manage/TaskForm";
import { setGoalStatus, setTaskActive } from "./actions";

const TIER_LABELS: Record<string, string> = {
  habit: "Habit",
  main_task: "Main Task",
  chore: "Chore",
};

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

  const [{ data: areas }, { data: goals }, { data: tasks }, { data: milestoneRows }] =
    await Promise.all([
      supabase.from("areas").select("id, name").order("name"),
      supabase
        .from("goals")
        .select("id, title, status, area_id, milestones(id, title, order_index, status)")
        .eq("player_id", player.id)
        .order("created_at"),
      supabase
        .from("tasks")
        .select("id, title, tier, area_id, recurrence, is_active, milestone_id")
        .eq("player_id", player.id)
        .order("title"),
      supabase
        .from("milestones")
        .select("id, title, goals!inner(title, status)")
        .eq("status", "active")
        .eq("goals.status", "active"),
    ]);

  const areasById = new Map((areas ?? []).map((area) => [area.id, area.name]));
  const milestoneOptions = (milestoneRows ?? []).map((m) => ({
    id: m.id,
    label: `${(m.goals as unknown as { title: string }).title} → ${m.title}`,
  }));

  const tasksByTier = {
    habit: (tasks ?? []).filter((t) => t.tier === "habit"),
    main_task: (tasks ?? []).filter((t) => t.tier === "main_task"),
    chore: (tasks ?? []).filter((t) => t.tier === "chore"),
  };

  return (
    <main className="flex-1 flex flex-col items-center gap-10 p-8 sm:p-16">
      <header className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Manage</h1>
        <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
          ← Today
        </Link>
      </header>

      <section className="w-full max-w-md flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Goals
        </h2>

        {(goals ?? []).map((goal) => (
          <div key={goal.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{goal.title}</p>
                <p className="text-xs text-foreground/60">
                  {areasById.get(goal.area_id)} · {goal.status}
                </p>
              </div>
              {goal.status === "active" && (
                <div className="flex gap-2">
                  <form action={setGoalStatus}>
                    <input type="hidden" name="goalId" value={goal.id} />
                    <input type="hidden" name="status" value="completed" />
                    <button className="text-xs text-foreground/60 hover:text-foreground">
                      Complete
                    </button>
                  </form>
                  <form action={setGoalStatus}>
                    <input type="hidden" name="goalId" value={goal.id} />
                    <input type="hidden" name="status" value="abandoned" />
                    <button className="text-xs text-foreground/60 hover:text-foreground">
                      Abandon
                    </button>
                  </form>
                </div>
              )}
            </div>

            <ul className="flex flex-col gap-1">
              {[...goal.milestones]
                .sort((a, b) => a.order_index - b.order_index)
                .map((milestone) => (
                  <li key={milestone.id} className="text-sm text-foreground/80">
                    {milestone.order_index}. {milestone.title}
                    {milestone.status === "completed" && " ✓"}
                  </li>
                ))}
            </ul>

            {goal.status === "active" && <MilestoneForm goalId={goal.id} />}
          </div>
        ))}

        <GoalForm playerId={player.id} areas={areas ?? []} />
      </section>

      <section className="w-full max-w-md flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Tasks
        </h2>

        {(["habit", "main_task", "chore"] as const).map((tier) => (
          <div key={tier} className="flex flex-col gap-2">
            <h3 className="text-xs text-foreground/60">{TIER_LABELS[tier]}</h3>
            <ul className="flex flex-col gap-1">
              {tasksByTier[tier].map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded border border-foreground/10 px-3 py-2 text-sm"
                >
                  <span className={task.is_active ? "" : "text-foreground/40 line-through"}>
                    {task.title}{" "}
                    <span className="text-xs text-foreground/40">
                      ({areasById.get(task.area_id)})
                    </span>
                  </span>
                  <form action={setTaskActive}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="isActive" value={(!task.is_active).toString()} />
                    <button className="text-xs text-foreground/60 hover:text-foreground">
                      {task.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <TaskForm playerId={player.id} areas={areas ?? []} milestoneOptions={milestoneOptions} />
      </section>
    </main>
  );
}
