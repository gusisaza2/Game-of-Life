-- Events: things that happen at a set date and time (a studio session, an
-- appointment). Unlike a task they can't be done early and have no deadline
-- -- they just happen. An event may hang off a Milestone (and so a Goal) or
-- stand alone, and tasks can be linked to it as preparation.
--
-- Times are plain local date + time with no timezone: the app is single
-- player and runs on Bogota time, the same way every other date here works.
-- end_time earlier than start_time means the event runs past midnight.
--
-- Marking an event "happened" awards XP like a Main Task does, so the XP
-- bookkeeping columns mirror task_logs (the same snapshots make undoing it
-- reversible). Events don't count toward the Good Day.
do $$
begin
  create type event_status as enum ('scheduled', 'happened', 'missed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  area_id uuid not null references areas(id) on delete restrict,
  milestone_id uuid references milestones(id) on delete set null,
  title text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  status event_status not null default 'scheduled',
  -- The day it was marked happened/missed/cancelled; XP is awarded on it.
  resolved_on date,
  xp_awarded numeric(6, 2) not null default 0,
  xp_type text not null default 'growth' check (xp_type in ('growth', 'bonus')),
  reengagement_bonus_xp numeric(9, 2) not null default 0,
  prev_area_capacity numeric(9, 2),
  prev_area_last_activity_date date,
  prev_area_decay_cycle_start_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_player_date on events (player_id, event_date);
create index if not exists idx_events_milestone on events (milestone_id);

-- A task can be preparation for an event.
alter table tasks add column if not exists event_id uuid references events(id) on delete set null;
create index if not exists idx_tasks_event on tasks (event_id);

-- Same open access as every other table in this single-player app.
alter table events enable row level security;
drop policy if exists "allow_all_events" on events;
create policy "allow_all_events" on events for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on events to anon, authenticated;
