// CSV export of the player's full history, linked from Habit Stats. The
// point is a copy that lives outside Supabase -- the free tier can pause a
// project, and a long-paused one can eventually be deleted -- so this is
// the "I own my own history" escape hatch, not a feature of the game.
//
//   GET /api/export?dataset=completions   every Task completion
//   GET /api/export?dataset=good-days     the per-day Good Day breakdown
//   GET /api/export?dataset=full          EVERY table as one JSON file (the
//                                         real backup: enough to rebuild the game)
//
// Like the rest of this single-player app there is no auth; this exposes
// nothing the Today/Habit Stats pages don't already show.
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { getTodayDateString } from "@/lib/today";

export const dynamic = "force-dynamic";

type Cell = string | number | boolean | null | undefined;

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A task title starting with = + - @ would run as a formula when the
  // file is opened in Excel/Sheets. Only text can be tampered with that
  // way, so numbers (which can legitimately be negative) are left alone.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: Cell[][]): string {
  // BOM so Excel reads the accents in Spanish task titles correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

type CompletionRow = {
  completed_date: string;
  xp_awarded: number;
  xp_type: string;
  streak_xp_awarded: number;
  reengagement_bonus_xp: number;
  // PostgREST embeds are typed loosely; a deleted task leaves this null.
  tasks: { title: string; tier: string; areas: { name: string } | null } | null;
};

type GoodDayRow = {
  date: string;
  habit_pct: number;
  main_task_pct: number;
  chore_pct: number;
  good_day_pct: number;
  is_good_day: boolean;
};

// Every table, with a stable total order so paging never repeats or skips a
// row. Tables without an `id` order by their own key. Add new tables here when
// a migration creates one -- a table missing from this list is missing from the
// backup.
const FULL_BACKUP_TABLES: { name: string; order: string[] }[] = [
  { name: "areas", order: ["id"] },
  { name: "players", order: ["id"] },
  { name: "area_capacities", order: ["player_id", "area_id"] },
  { name: "goals", order: ["id"] },
  { name: "milestones", order: ["id"] },
  { name: "tasks", order: ["id"] },
  { name: "task_logs", order: ["id"] },
  { name: "daily_good_days", order: ["player_id", "date"] },
  { name: "events", order: ["id"] },
  { name: "time_blocks", order: ["id"] },
];

async function fullBackup(today: string): Promise<Response> {
  const supabase = await createClient();
  const tables: Record<string, unknown[]> = {};
  for (const { name, order } of FULL_BACKUP_TABLES) {
    tables[name] = await fetchAllRows<Record<string, unknown>>((from, to) => {
      let query = supabase.from(name).select("*");
      for (const column of order) query = query.order(column, { ascending: true });
      return query.range(from, to);
    });
  }
  const rowCounts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
  const body = JSON.stringify({ exported_at: today, row_counts: rowCounts, tables }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="game-of-life-backup-${today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const dataset = new URL(request.url).searchParams.get("dataset");
  if (dataset === "full") {
    try {
      return await fullBackup(getTodayDateString());
    } catch {
      return Response.json({ error: "Export failed." }, { status: 500 });
    }
  }
  if (dataset !== "completions" && dataset !== "good-days") {
    return Response.json(
      { error: 'dataset must be "completions", "good-days" or "full"' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("id").single();
  if (!player) return Response.json({ error: "No player found." }, { status: 404 });

  const today = getTodayDateString();

  try {
    if (dataset === "completions") {
      const rows = await fetchAllRows<CompletionRow>((from, to) =>
        supabase
          .from("task_logs")
          .select(
            "completed_date, xp_awarded, xp_type, streak_xp_awarded, reengagement_bonus_xp, tasks(title, tier, areas(name))",
          )
          .eq("player_id", player.id)
          .order("completed_date", { ascending: true })
          .order("id", { ascending: true })
          // The embeds are many-to-one, so at runtime `tasks`/`areas` are
          // single objects; without generated DB types supabase-js infers
          // them as arrays, hence the cast to the real shape.
          .range(from, to) as unknown as PromiseLike<{
          data: CompletionRow[] | null;
          error: { message: string } | null;
        }>,
      );

      return csvResponse(
        toCsv(
          ["date", "task", "tier", "area", "xp_awarded", "xp_type", "streak_bonus_xp", "reengagement_bonus_xp"],
          rows.map((r) => [
            r.completed_date,
            r.tasks?.title ?? "(deleted task)",
            r.tasks?.tier,
            r.tasks?.areas?.name,
            r.xp_awarded,
            r.xp_type,
            r.streak_xp_awarded,
            r.reengagement_bonus_xp,
          ]),
        ),
        `game-of-life-completions-${today}.csv`,
      );
    }

    const rows = await fetchAllRows<GoodDayRow>((from, to) =>
      supabase
        .from("daily_good_days")
        .select("date, habit_pct, main_task_pct, chore_pct, good_day_pct, is_good_day")
        .eq("player_id", player.id)
        .order("date", { ascending: true })
        .range(from, to),
    );

    return csvResponse(
      toCsv(
        ["date", "habit_pct", "main_task_pct", "chore_pct", "good_day_pct", "is_good_day"],
        rows.map((r) => [r.date, r.habit_pct, r.main_task_pct, r.chore_pct, r.good_day_pct, r.is_good_day]),
      ),
      `game-of-life-good-days-${today}.csv`,
    );
  } catch {
    return Response.json({ error: "Export failed." }, { status: 500 });
  }
}
