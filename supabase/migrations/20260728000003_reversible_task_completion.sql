-- Bug fix: un-completing a task (unchecking it) only ever reversed the
-- task's own tier XP from cumulative_xp. It never reversed the
-- re-engagement bonus XP (formula #6) that fires on a genuine-lapse
-- completion, nor the AreaCapacity reset (capacity/last_activity_date/
-- decay_cycle_start_date) that every completion applies -- both stayed
-- permanently "applied" even after the completion was undone.
--
-- Fix: snapshot what registerAreaActivity is about to overwrite, plus the
-- bonus XP awarded, directly on the task_log row at completion time, so
-- un-completing can restore both precisely instead of leaving them stuck.
alter table task_logs add column reengagement_bonus_xp numeric(9, 2) not null default 0;
alter table task_logs add column prev_area_capacity numeric(9, 2);
alter table task_logs add column prev_area_last_activity_date date;
alter table task_logs add column prev_area_decay_cycle_start_date date;
