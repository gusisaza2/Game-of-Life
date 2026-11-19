import { AreaIcon } from "@/components/AreaIcon";
import { SectionHeading } from "@/components/SectionHeading";
import { TaskItem, type Task } from "@/components/TaskSection";
import { areaColor } from "@/lib/area-colors";
import { compareByDeadline, deadlineStatus } from "@/lib/deadline";

export type MissionGroup = {
  goalId: string;
  title: string;
  areaName?: string;
  milestones: { id: string; title: string; tasks: Task[] }[];
};

// Today's Missions the way they're organized behind the scenes: by Goal
// (project), and inside each Goal by Milestone, in the Milestone's own order.
// Each Goal is a collapsible card whose summary tells at a glance how much is
// open and how much is overdue; the most urgent Goal starts open.
export function MissionGroups({
  groups,
  completedIds,
  playerId,
  today,
}: {
  groups: MissionGroup[];
  completedIds: Set<string>;
  playerId: string;
  today: string;
}) {
  const all = groups.flatMap((g) => g.milestones.flatMap((m) => m.tasks));
  if (all.length === 0) return null;
  const doneCount = all.filter((t) => completedIds.has(t.id)).length;

  return (
    <section className="w-full max-w-md">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
          Misiones
        </SectionHeading>
        <span className="text-xs tabular-nums text-foreground/35">
          {doneCount}/{all.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((group, index) => {
          const tasks = group.milestones.flatMap((m) => m.tasks);
          const open = tasks.filter((t) => !completedIds.has(t.id));
          const overdue = open.filter(
            (t) => t.due_date && deadlineStatus(t.due_date, today).kind === "overdue",
          ).length;
          const accent = areaColor(group.areaName).accent;
          // The milestone that starts open is the one holding the most urgent
          // open Mission (earliest deadline; undated last, then milestone order).
          const currentMilestoneId = [...group.milestones]
            .map((m, order) => ({
              id: m.id,
              order,
              due:
                m.tasks
                  .filter((t) => !completedIds.has(t.id))
                  .map((t) => t.due_date ?? "9999-12-31")
                  .sort()[0] ?? null,
            }))
            .filter((m) => m.due !== null)
            .sort((a, b) => (a.due as string).localeCompare(b.due as string) || a.order - b.order)[0]?.id;

          return (
            <details
              key={group.goalId}
              open={index === 0}
              className="group rounded-xl border border-foreground/20 bg-surface"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              <summary className="flex cursor-pointer select-none list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="text-xs text-foreground/40 transition-transform group-open:rotate-90"
                >
                  ▸
                </span>
                <span className="flex min-w-[140px] flex-1 items-center gap-2">
                  <AreaIcon areaName={group.areaName} className="h-4 w-4 shrink-0 text-foreground/60" />
                  <span className="min-w-0 text-sm font-medium">{group.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-foreground/45">
                  {overdue > 0 && (
                    <span style={{ color: "var(--accent-effort)" }}>{overdue} overdue</span>
                  )}
                  <span>
                    {open.length === 0 ? "all done" : `${open.length} open`}
                  </span>
                </span>
              </summary>

              <div className="flex flex-col gap-2 px-2 pb-3 sm:px-3">
                {group.milestones.map((milestone) => {
                  const milestoneOpen = milestone.tasks.filter((t) => !completedIds.has(t.id)).length;
                  // The milestone being worked on (the first with something
                  // still open) starts open; the later ones wait collapsed.
                  const isCurrent = milestone.id === currentMilestoneId;
                  return (
                    <details key={milestone.id} open={isCurrent} className="group/ms">
                      <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 py-1 text-xs text-foreground/55 [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span aria-hidden className="text-[10px] text-foreground/35 transition-transform group-open/ms:rotate-90">
                            ▸
                          </span>
                          <span className="min-w-0 font-medium">{milestone.title}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground/40">
                          {milestoneOpen === 0 ? "done" : `${milestoneOpen} open`}
                        </span>
                      </summary>
                      <ul className="flex flex-col gap-2 pt-1">
                        {[...milestone.tasks]
                          .sort((a, b) =>
                            compareByDeadline({ ...a, due_date: a.due_date ?? null }, { ...b, due_date: b.due_date ?? null }),
                          )
                          .map((task) => (
                            <TaskItem
                              key={task.id}
                              task={task}
                              completed={completedIds.has(task.id)}
                              playerId={playerId}
                              today={today}
                            />
                          ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
