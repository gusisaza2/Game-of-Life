-- Task Activation Delay (CLAUDE.md Section 9 / design doc Section 6.5) and
-- live XP feedback support (design doc Section 2.1).

-- A task needs to know when it was created (to compute "day after
-- creation") and whether it's exempt (Path template / system-seeded, not
-- fabricated in the moment by the player).
alter table tasks
  add column source text not null default 'custom',
  add column created_at timestamptz not null default now();

alter table tasks
  add constraint tasks_source_check check (source in ('custom', 'path_template', 'system'));

-- task_logs need to distinguish Growth XP (feeds cumulative_xp / the
-- Chapter-up gate) from Bonus XP (same-day-created non-exempt tasks; feeds
-- neither cumulative_xp nor the per-area daily ceiling — same channel
-- already reserved for Side Quests, per design doc Section 6.1).
alter table task_logs
  add column xp_type text not null default 'growth';

alter table task_logs
  add constraint task_logs_xp_type_check check (xp_type in ('growth', 'bonus'));

-- Backfill: the existing "Just Stabilize" seed tasks are Path template
-- content, not player-authored — exempt from the activation delay.
update tasks
  set source = 'path_template'
  where title in ('Sleep on schedule', 'Go for a short walk', 'Text one friend back');

-- Seed the new system Habit — always available, no Milestone required,
-- standard Habit-tier XP, exempt from the activation delay (it's
-- pre-designed content, not fabricated in the moment).
insert into tasks (player_id, milestone_id, area_id, tier, title, recurrence, is_active, source)
select
  p.id,
  null,
  a.id,
  'habit',
  'Planned tomorrow',
  'daily',
  true,
  'system'
from players p, areas a
where a.name = 'Mental Health'
limit 1;
