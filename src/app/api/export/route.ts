// CSV export of the player's full history, linked from Habit Stats. The
// point is a copy that lives outside Supabase -- the free tier can pause a
// project, and a long-paused one can eventually be deleted -- so this is
// the "I own my own history" escape hatch, not a feature of the game.
//
//   GET /api/export?dataset=completions   every Task completion
//   GET /api/export?dataset=good-days     the per-day Good Day breakdown
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

export async function GET(request: Request) {
  const dataset = new URL(request.url).searchParams.get("dataset");
  if (dataset !== "completions" && dataset !== "good-days") {
    return Response.json(
      { error: 'dataset must be "completions" or "good-days"' },
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
