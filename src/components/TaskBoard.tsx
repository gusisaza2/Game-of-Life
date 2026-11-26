"use client";

import { useState } from "react";
import Link from "next/link";
import { MissionGroups, type MissionGroup } from "@/components/MissionGroups";
import { SectionHeading } from "@/components/SectionHeading";
import { TaskList, type Task } from "@/components/TaskSection";
import { ChoreSlot } from "@/components/ChoreSlot";
import { DueDateInput } from "@/components/DueDateInput";
import { StarPicker } from "@/components/Stars";
import { buildMissionGroups, type BoardTask } from "@/lib/mission-groups";
import {
  SORT_LABELS,
  STAR_FILTER_LABELS,
  TOP_PRIORITY_SOFT_LIMIT,
  WHEN_FILTER_LABELS,
  compareByDue,
  compareByTitle,
  dueBucket,
  matchesStars,
  matchesWhen,
  type SortKey,
  type StarFilter,
  type WhenFilter,
} from "@/lib/task-view";
import { useStoredView } from "@/lib/use-stored-view";

const selectClass = "rounded-lg border border-foreground/20 bg-surface px-2 py-1 text-xs";

const TODAY_WHEN: WhenFilter[] = ["open", "overdue", "today", "soon", "nodate"];
const PAGE_WHEN: WhenFilter[] = ["open", "overdue", "today", "soon", "later", "nodate", "done", "all"];

// A list of Missions or chores the player can organize (Goal, priority, due
// date, A-Z) and filter. On Today it shows what Today holds; on its own page
// ("page" mode) it holds everything and each row can change stars and date.
export function TaskBoard({
  kind,
  mode,
  tasks,
  completedIds,
  lockedIds,
  activeChores,
  playerId,
  today,
}: {
  kind: "mission" | "chore";
  mode: "today" | "page";
  tasks: BoardTask[];
  completedIds: Set<string>;
  // Finished on an earlier day.
  lockedIds?: Set<string>;
  // Chores page: the ones currently holding Today's slots.
  activeChores?: { id: string; title: string }[];
  playerId: string;
  today: string;
}) {
  const sortKeys: SortKey[] = kind === "mission" ? ["goal", "priority", "due", "alpha"] : ["priority", "due", "alpha"];
  const [sort, setSort] = useStoredView<SortKey>(`gol:view-${kind}-${mode}`, sortKeys[0], sortKeys);
  // Filters start clear on every visit, so nothing stays hidden by accident.
  const [goal, setGoal] = useState("all");
  const [area, setArea] = useState("all");
  const [stars, setStars] = useState<StarFilter>("all");
  const [when, setWhen] = useState<WhenFilter>("open");

  const isLocked = (id: string) => lockedIds?.has(id) ?? false;
  // What the list holds before any filtering (finished-earlier ones only show
  // when asked for).
  const base = tasks.filter((t) => !isLocked(t.id));
  const shown = tasks.filter(
    (t) =>
      (goal === "all" || t.goalId === goal) &&
      (area === "all" || t.areaName === area) &&
      matchesStars(t.priority ?? 0, stars) &&
      matchesWhen(t, completedIds.has(t.id), when, today) &&
      !(when === "open" && isLocked(t.id)),
  );
  const filtering = goal !== "all" || area !== "all" || stars !== "all" || when !== "open";

  if (mode === "today" && tasks.length === 0) return null;

  const goals = [...new Map(tasks.map((t) => [t.goalId, t.goalTitle])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const areas = [...new Set(tasks.map((t) => t.areaName).filter((a): a is string => !!a))].sort();
  const doneCount = shown.filter((t) => completedIds.has(t.id)).length;
  const topOpen = tasks.filter((t) => (t.priority ?? 0) === 3 && !completedIds.has(t.id)).length;

  const clear = () => {
    setGoal("all");
    setArea("all");
    setStars("all");
    setWhen("open");
  };

  const renderExtra =
    mode === "page"
      ? (task: Task) => (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
            <StarPicker taskId={task.id} value={task.priority ?? 0} />
            {!completedIds.has(task.id) && (
              <DueDateInput taskId={task.id} value={task.due_date ?? null} today={today} />
            )}
            {kind === "chore" && activeChores && !completedIds.has(task.id) && (
              <ChoreSlot chore={{ id: task.id }} active={activeChores} />
            )}
          </div>
        )
      : undefined;

  const list = (items: BoardTask[], compare?: (a: Task, b: Task) => number) => (
    <TaskList
      tasks={items}
      completedIds={completedIds}
      lockedIds={lockedIds}
      playerId={playerId}
      today={today}
      compare={compare}
      renderExtra={renderExtra}
      openCompleted={when === "done"}
    />
  );

  const section = (key: string, label: string, items: BoardTask[], compare?: (a: Task, b: Task) => number) => {
    if (items.length === 0) return null;
    const open = items.filter((t) => !completedIds.has(t.id)).length;
    return (
      <div key={key} className="flex flex-col gap-1.5">
        <p className="flex items-baseline justify-between text-xs text-foreground/55">
          <span className="font-medium">{label}</span>
          <span className="tabular-nums text-foreground/40">{open === 0 ? "done" : `${open} open`}</span>
        </p>
        {list(items, compare)}
      </div>
    );
  };

  let body: React.ReactNode;
  if (shown.length === 0) {
    body = <p className="text-sm text-foreground/45">Nothing matches these filters.</p>;
  } else if (sort === "goal") {
    const groups: MissionGroup[] = buildMissionGroups(shown, completedIds);
    body = (
      <MissionGroups
        // A new set of filters re-applies which groups start open.
        key={filtering ? "filtered" : "all"}
        groups={groups}
        completedIds={completedIds}
        lockedIds={lockedIds}
        playerId={playerId}
        today={today}
        renderExtra={renderExtra}
        openAll={filtering}
        openCompleted={when === "done"}
      />
    );
  } else if (sort === "priority") {
    body = [3, 2, 1, 0].map((n) =>
      section(
        `p${n}`,
        n === 0 ? "No stars" : "★".repeat(n),
        shown.filter((t) => (t.priority ?? 0) === n),
        compareByDue,
      ),
    );
  } else if (sort === "due") {
    const live = shown.filter((t) => !isLocked(t.id));
    const labels = new Map(live.map((t) => [dueBucket(t.due_date, today).order, dueBucket(t.due_date, today).label]));
    body = (
      <>
        {[...labels.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([order, label]) =>
            section(
              `d${order}`,
              label,
              live.filter((t) => dueBucket(t.due_date, today).order === order),
              compareByDue,
            ),
          )}
        {section("earlier", "Finished earlier", shown.filter((t) => isLocked(t.id)), compareByDue)}
      </>
    );
  } else {
    body = list(shown, compareByTitle);
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-2">
      {mode === "today" && (
        <div className="flex items-baseline justify-between">
          <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            Misiones
          </SectionHeading>
          <span className="flex items-baseline gap-3">
            <span className="text-xs tabular-nums text-foreground/35">
              {doneCount}/{shown.length}
            </span>
            <Link href="/missions" className="link-hover text-xs text-foreground/55">
              See all →
            </Link>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1 text-xs text-foreground/50">
          Organize
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass}>
            {sortKeys.map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        {kind === "mission" && (
          <select
            aria-label="Filter by Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className={`${selectClass} max-w-[10rem]`}
          >
            <option value="all">All Goals</option>
            {goals.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filter by stars"
          value={stars}
          onChange={(e) => setStars(e.target.value as StarFilter)}
          className={selectClass}
        >
          {(Object.keys(STAR_FILTER_LABELS) as StarFilter[])
            .sort((a, b) => ["all", "3", "2", "1", "0"].indexOf(a) - ["all", "3", "2", "1", "0"].indexOf(b))
            .map((k) => (
              <option key={k} value={k}>
                {STAR_FILTER_LABELS[k]}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter by date"
          value={when}
          onChange={(e) => setWhen(e.target.value as WhenFilter)}
          className={selectClass}
        >
          {(mode === "today" ? TODAY_WHEN : PAGE_WHEN).map((k) => (
            <option key={k} value={k}>
              {mode === "today" && k === "open" ? "Any date" : WHEN_FILTER_LABELS[k]}
            </option>
          ))}
        </select>
        {mode === "page" && areas.length > 1 && (
          <select
            aria-label="Filter by area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={selectClass}
          >
            <option value="all">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtering && (
        <p className="text-xs text-foreground/50">
          Showing {shown.length} of {base.length} ·{" "}
          <button type="button" onClick={clear} className="link-hover underline">
            Clear filters
          </button>
        </p>
      )}
      {topOpen > TOP_PRIORITY_SOFT_LIMIT && (
        <p className="text-xs" style={{ color: "var(--accent-effort)" }}>
          {topOpen} open tasks have three stars. If everything is top priority, nothing is.
        </p>
      )}

      {body}
    </section>
  );
}
