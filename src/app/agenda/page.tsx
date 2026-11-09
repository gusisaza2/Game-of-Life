import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNowTimeString, getTodayDateString } from "@/lib/today";
import { isValidDateString, shiftDate } from "@/lib/deadline";
import { weekDates } from "@/lib/agenda-layout";
import { AgendaView } from "@/components/AgendaView";
import type { AgendaItem } from "@/components/AgendaSheets";

// How far back and forward the agenda can be browsed.
const BROWSE_BACK_DAYS = 14;
const BROWSE_FORWARD_DAYS = 90;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const today = getTodayDateString();

  const params = await searchParams;
  const view: "day" | "week" = params.view === "week" ? "week" : "day";
  const date =
    params.date &&
    isValidDateString(params.date) &&
    params.date >= shiftDate(today, -BROWSE_BACK_DAYS) &&
    params.date <= shiftDate(today, BROWSE_FORWARD_DAYS)
      ? params.date
      : today;

  const days = view === "week" ? weekDates(date) : [date];
  const first = days[0];
  const last = days[days.length - 1];

  const { data: player } = await supabase.from("players").select("id").single();
  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  const [{ data: eventRows }, { data: blockRows }, { data: areas }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, area_id, event_date, start_time, end_time, location, status")
      .eq("player_id", player.id)
      .in("status", ["scheduled", "happened"])
      .gte("event_date", first)
      .lte("event_date", last),
    supabase
      .from("time_blocks")
      .select("id, block_date, start_time, end_time, status, tasks(title, area_id)")
      .eq("player_id", player.id)
      .in("status", ["planned", "done"])
      .gte("block_date", first)
      .lte("block_date", last),
    supabase.from("areas").select("id, name"),
  ]);

  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name as string]));

  const items: AgendaItem[] = [
    ...(eventRows ?? []).map((e) => ({
      kind: "event" as const,
      id: e.id,
      title: e.title,
      date: e.event_date,
      start: e.start_time,
      end: e.end_time,
      location: e.location,
      areaName: areaNameById.get(e.area_id),
      status: e.status as string,
    })),
    // Many-to-one embeds come back as objects; supabase-js infers arrays.
    ...((blockRows ?? []) as unknown as {
      id: string;
      block_date: string;
      start_time: string;
      end_time: string;
      status: string;
      tasks: { title: string; area_id: string } | null;
    }[]).map((b) => ({
      kind: "block" as const,
      id: b.id,
      title: b.tasks?.title ?? "Task",
      date: b.block_date,
      start: b.start_time,
      end: b.end_time,
      location: null,
      areaName: b.tasks ? areaNameById.get(b.tasks.area_id) : undefined,
      status: b.status,
    })),
  ];

  const step = view === "week" ? 7 : 1;
  const prevHref = `/agenda?view=${view}&date=${shiftDate(date, -step)}`;
  const nextHref = `/agenda?view=${view}&date=${shiftDate(date, step)}`;

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <div className="flex items-baseline gap-4">
          <Link href="/plan" className="link-hover text-sm text-foreground/50">
            Plan →
          </Link>
          <Link href="/" className="link-hover text-sm text-foreground/50">
            ← Today
          </Link>
        </div>
      </div>
      <AgendaView
        playerId={player.id}
        view={view}
        date={date}
        days={days}
        initialNow={{ date: today, time: getNowTimeString() }}
        items={items}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </main>
  );
}
