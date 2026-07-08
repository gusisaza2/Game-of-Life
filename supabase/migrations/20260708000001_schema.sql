-- Game of Life — core schema (Phase 1 / MVP)
-- See CLAUDE.md "Data model" section for the spec this implements.

create extension if not exists pgcrypto;

-- ─── Areas ──────────────────────────────────────────────────────────────
-- Fixed seed data — 5 rows, never player-editable.
create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_foundation boolean not null default false
);

-- ─── Players ────────────────────────────────────────────────────────────
-- Single row for MVP — no multi-user yet.
create table players (
  id uuid primary key default gen_random_uuid(),
  current_level integer not null default 0, -- 0 = Tutorial
  tutorial_complete boolean not null default false,
  lifetime_good_day_count integer not null default 0,
  cumulative_xp integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── AreaCapacity ───────────────────────────────────────────────────────
-- One row per Player × Area.
create table area_capacities (
  player_id uuid not null references players(id) on delete cascade,
  area_id uuid not null references areas(id) on delete restrict,
  capacity numeric(5, 2) not null,
  last_activity_date date,
  decay_cycle_start_date date,
  primary key (player_id, area_id)
);

-- ─── Goals ──────────────────────────────────────────────────────────────
create type goal_status as enum ('draft', 'active', 'completed', 'abandoned');
create type goal_source as enum ('custom', 'path_template');

create table goals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  area_id uuid not null references areas(id) on delete restrict,
  secondary_area_ids uuid[] not null default '{}',
  title text not null,
  status goal_status not null default 'draft',
  source goal_source not null default 'custom',
  path_template_id text,
  created_at timestamptz not null default now()
);

-- ─── Milestones ─────────────────────────────────────────────────────────
create type milestone_status as enum ('active', 'completed');

create table milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  order_index integer not null,
  status milestone_status not null default 'active'
);

-- ─── Tasks ──────────────────────────────────────────────────────────────
create type task_tier as enum ('main_task', 'habit', 'chore');
create type task_recurrence as enum ('daily', 'weekly', 'custom');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  area_id uuid not null references areas(id) on delete restrict,
  tier task_tier not null,
  title text not null,
  recurrence task_recurrence not null default 'daily',
  is_active boolean not null default true,
  constraint main_task_requires_milestone check (
    tier <> 'main_task' or milestone_id is not null
  )
);

-- A main_task's milestone must belong to an active goal (can't express
-- "another table's column" in a check constraint, so this is a trigger).
create or replace function enforce_main_task_milestone_active()
returns trigger
language plpgsql
as $$
declare
  v_goal_status goal_status;
begin
  if new.tier = 'main_task' then
    select g.status into v_goal_status
    from milestones m
    join goals g on g.id = m.goal_id
    where m.id = new.milestone_id;

    if v_goal_status is distinct from 'active' then
      raise exception 'main_task tasks must be linked to a milestone whose goal is active';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_main_task_milestone_active
  before insert or update on tasks
  for each row execute function enforce_main_task_milestone_active();

-- ─── TaskLog ────────────────────────────────────────────────────────────
-- One row per completion.
create table task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  completed_date date not null,
  xp_awarded numeric(6, 2) not null default 0
);

-- ─── DailyGoodDay ───────────────────────────────────────────────────────
-- One row per player per day, computed at day-rollover.
create table daily_good_days (
  player_id uuid not null references players(id) on delete cascade,
  date date not null,
  habit_pct numeric(4, 3) not null,
  main_task_pct numeric(4, 3) not null,
  chore_pct numeric(4, 3) not null,
  good_day_pct numeric(4, 3) not null,
  is_good_day boolean not null,
  primary key (player_id, date)
);

-- ─── Indexes for common access patterns ────────────────────────────────
create index idx_tasks_player_active on tasks (player_id, is_active);
create index idx_tasks_milestone on tasks (milestone_id);
create index idx_task_logs_task_date on task_logs (task_id, completed_date);
create index idx_task_logs_player_date on task_logs (player_id, completed_date);
create index idx_goals_player_status on goals (player_id, status);
create index idx_milestones_goal on milestones (goal_id);

-- ─── Access grants ──────────────────────────────────────────────────────
-- Personal single-user app, no auth system yet (per CLAUDE.md). RLS is
-- intentionally left off; access control returns when auth is introduced.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
