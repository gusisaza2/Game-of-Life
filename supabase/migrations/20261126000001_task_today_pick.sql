-- Today shows at most 3 chores. The player can choose which ones from the
-- "All chores" window; today_pick records that choice (when it was picked),
-- so it's the same on every device. Null means not chosen -- free slots are
-- filled automatically (a chore with a work block today, then the most urgent).
alter table tasks add column if not exists today_pick timestamptz;
