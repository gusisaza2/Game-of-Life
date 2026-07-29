-- Backlog tasks: a Task can now be created inactive (planned for a
-- Milestone but not due yet) and activated later. The Task Activation
-- Delay (CLAUDE.md #9) keys off *when a task starts earning full Growth
-- XP*, which should be "the day after it's activated," not "the day
-- after it's created" -- otherwise a task planned weeks ago would skip
-- the delay entirely the moment it's turned on. `activated_at` tracks
-- that separately from `created_at` (which stays a pure creation
-- timestamp). Existing rows are already active, so backfill it to their
-- created_at -- their delay window has long since passed either way.
alter table tasks add column activated_at timestamptz not null default now();
update tasks set activated_at = created_at;
