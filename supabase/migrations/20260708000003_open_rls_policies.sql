-- Game of Life — permissive RLS policies (Phase 1 / MVP)
-- Supabase auto-enables RLS on every new table. With no policies, PostgREST
-- (anon/authenticated) sees zero rows even though grants were correct.
-- This is a personal single-user app with no auth system yet (per
-- CLAUDE.md) — allow full access for now. Replace with real per-user
-- policies once auth is introduced.

create policy "allow_all_areas" on areas for all to anon, authenticated using (true) with check (true);
create policy "allow_all_players" on players for all to anon, authenticated using (true) with check (true);
create policy "allow_all_area_capacities" on area_capacities for all to anon, authenticated using (true) with check (true);
create policy "allow_all_goals" on goals for all to anon, authenticated using (true) with check (true);
create policy "allow_all_milestones" on milestones for all to anon, authenticated using (true) with check (true);
create policy "allow_all_tasks" on tasks for all to anon, authenticated using (true) with check (true);
create policy "allow_all_task_logs" on task_logs for all to anon, authenticated using (true) with check (true);
create policy "allow_all_daily_good_days" on daily_good_days for all to anon, authenticated using (true) with check (true);
