-- Work blocks: time the player sets aside, by their own choice, to work on a
-- task ("tomorrow 4-6pm on Edit Magnolia"). Different from an event (fixed
-- by someone else, just happens) and from a task (a deliverable with a
-- deadline): a block says WHEN the player will work on a task.
--
-- A block never completes its task -- working two hours on it doesn't finish
-- it. It only records that the time was set aside and whether it was used.
-- Blocks award no XP and don't count toward the Good Day.
--
-- Date and time are plain local values with no timezone, like everything
-- else here (single player, Bogota). A block stays within one day, so
-- end_time must be later than start_time.
do $$
begin
  create type time_block_status as enum ('planned', 'done', 'skipped');
exception
  when duplicate_object then null;
end $$;

create table if not exists time_blocks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  status time_block_status not null default 'planned',
  -- The day it was marked done/skipped.
  resolved_on date,
  note text,
  created_at timestamptz not null default now(),
  constraint time_blocks_end_after_start check (end_time > start_time)
);

create index if not exists idx_time_blocks_player_date on time_blocks (player_id, block_date);
create index if not exists idx_time_blocks_task on time_blocks (task_id);

-- Same open access as every other table in this single-player app.
alter table time_blocks enable row level security;
do $$
begin
  create policy "allow_all_time_blocks" on time_blocks for all to anon, authenticated using (true) with check (true);
exception
  when duplicate_object then null;
end $$;
grant select, insert, update, delete on time_blocks to anon, authenticated;
