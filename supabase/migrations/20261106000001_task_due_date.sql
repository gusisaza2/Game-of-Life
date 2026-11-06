-- Deadlines for one-off tasks (Main Tasks and Chores). Habits recur, so they
-- never get one.
--   due_date  -- the date the task has to be finished by
--   done_date -- set when a dated task is completed; it then stays done for
--                good instead of coming back unchecked the next day
-- Both are nullable on purpose: existing tasks have no deadline yet, and the
-- "deadline required" rule is added in a later migration, once they've all
-- been dated.
alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists done_date date;
