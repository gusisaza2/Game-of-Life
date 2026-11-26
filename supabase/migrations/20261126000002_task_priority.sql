-- Priority stars (0 = not decided, 1-3) for Missions and chores. Stars order
-- and filter lists; they never change how much XP a task is worth.
alter table tasks add column if not exists priority smallint not null default 0 check (priority between 0 and 3);
