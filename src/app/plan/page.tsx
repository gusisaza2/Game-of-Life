import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { getTodayDateString, getTomorrowDateString } from "@/lib/today";
import { isValidDateString, shiftDate } from "@/lib/deadline";
import { TIER_XP_MULTIPLIER, perAreaDailyXpCeiling } from "@/lib/leveling";
import { durationMinutes } from "@/lib/time-blocks";
import { PlanView, type PlanTask, type TimelineItem } from "@/components/PlanView";

// How far ahead a day can be planned.
const PLAN_HORIZON_DAYS = 14;

type TaskRow = {
  id: string;
  title: string;
  tier: string;
  area_id: string;
  due_date: string | null;
  done_date: string | null;
  is_active: boolean;
  // Many-to-one embeds come back as objects, but supabase-js (no generated
  // types) infers arrays.
  milestones: { title: string; goals: { title: string } | null } | null;
};

type BlockRow = {
  id: string;
  task_id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const today = getTodayDateString();
  const tomorrow = getTomorrowDateString();

  const { date: dateParam } = await searchParams;
  const date =
    dateParam &&
    isValidDateString(dateParam) &&
    dateParam >= today &&
    dateParam <= shiftDate(today, PLAN_HORIZON_DAYS)
      ? dateParam
      : tomorrow;

  const { data: player } = await supabase.from("players").select("id, current_level").single();
  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  const [{ data: taskRows }, { data: areas }, { data: eventRows }, blockRows, { data: habit }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, tier, area_id, due_date, done_date, is_active, milestones(title, goals(title))",
        )
        .eq("player_id", player.id)
        .neq("tier", "habit"),
      supabase.from("areas").select("id, name, is_foundation"),
      supabase
        .from("events")
        .select("id, title, start_time, end_time, location, status")
        .eq("player_id", player.id)
        .eq("event_date", date)
        .in("status", ["scheduled", "happened"]),
      fetchAllRows<BlockRow>((from, to) =>
        supabase
          .from("time_blocks")
          .select("id, task_id, block_date, start_time, end_time, status")
          .eq("player_id", player.id)
          .order("block_date")
          .order("id")
          .range(from, to),
      ),
      // The seeded "Planned tomorrow" habit that "Finish planning" completes.
      supabase
        .from("tasks")
        .select("id")
        .eq("player_id", player.id)
        .eq("tier", "habit")
        .eq("title", "Planned tomorrow")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const habitDone = habit
    ? Boolean(
        (
          await supabase
            .from("task_logs")
            .select("id")
            .eq("task_id", habit.id)
            .eq("completed_date", today)
            .maybeSingle()
        ).data,
      )
    : false;

  const allTasks = (taskRows ?? []) as unknown as TaskRow[];
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const areaById = new Map((areas ?? []).map((a) => [a.id, a]));

  const blocksOnDate = blockRows.filter((b) => b.block_date === date && b.status !== "skipped");
  const blocksByTask = new Map<string, BlockRow[]>();
  for (const block of blocksOnDate) {
    blocksByTask.set(block.task_id, [...(blocksByTask.get(block.task_id) ?? []), block]);
  }

  // Time already spent on each task: its blocks marked done, on any day.
  const investedByTask = new Map<string, number>();
  for (const block of blockRows) {
    if (block.status !== "done") continue;
    investedByTask.set(
      block.task_id,
      (investedByTask.get(block.task_id) ?? 0) + durationMinutes(block.start_time, block.end_time),
    );
  }

  // What's still open to plan: active, unfinished Missions and Chores.
  const tasks: PlanTask[] = allTasks
    .filter((t) => t.is_active && !t.done_date)
    .map((t) => {
      const area = areaById.get(t.area_id);
      return {
        id: t.id,
        title: t.title,
        tier: t.tier,
        areaName: area?.name,
        dueDate: t.due_date,
        goalTitle: t.milestones?.goals?.title ?? null,
        milestoneTitle: t.milestones?.title ?? null,
        xp: TIER_XP_MULTIPLIER[t.tier as keyof typeof TIER_XP_MULTIPLIER] ?? 0,
        areaDailyCap: Math.round(perAreaDailyXpCeiling(player.current_level, area?.is_foundation ?? false) * 10) / 10,
        investedMinutes: investedByTask.get(t.id) ?? 0,
        blocks: (blocksByTask.get(t.id) ?? []).map((b) => ({
          id: b.id,
          start: b.start_time,
          end: b.end_time,
        })),
      };
    });

  const timeline: TimelineItem[] = [
    ...(eventRows ?? []).map((e) => ({
      kind: "event" as const,
      id: e.id,
      title: e.title,
      start: e.start_time,
      end: e.end_time,
      location: e.location,
      status: e.status as string,
    })),
    ...blocksOnDate.map((b) => ({
      kind: "block" as const,
      id: b.id,
      title: taskById.get(b.task_id)?.title ?? "Task",
      start: b.start_time,
      end: b.end_time,
      location: null,
      status: b.status,
    })),
  ].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const prevDate = date > today ? shiftDate(date, -1) : null;
  const nextDate = date < shiftDate(today, PLAN_HORIZON_DAYS) ? shiftDate(date, 1) : null;

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {date === tomorrow ? "Plan Tomorrow’s Day" : date === today ? "Plan Today" : "Plan a Day"}
        </h1>
        <Link href="/" className="link-hover text-sm text-foreground/50">
          ← Today
        </Link>
      </div>
      <PlanView
        playerId={player.id}
        today={today}
        date={date}
        prevDate={prevDate}
        nextDate={nextDate}
        tasks={tasks}
        timeline={timeline}
        planningHabit={habit ? { id: habit.id, done: habitDone } : null}
      />
    </main>
  );
}
