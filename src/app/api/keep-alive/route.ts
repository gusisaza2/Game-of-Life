// Called once a day by Vercel Cron (see vercel.json) purely to keep the
// Supabase free-tier project from auto-pausing: that plan pauses a
// project after ~7 days with no activity, which silently took the whole
// app down ("No player found." with a database host that stopped
// resolving) until the project was restored by hand from the dashboard.
// Any real query counts as activity, so this just does the cheapest
// read there is and returns nothing sensitive.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("areas").select("id").limit(1);

  // A failure here is worth seeing in Vercel's cron logs, so report it as
  // a real error status instead of swallowing it.
  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
