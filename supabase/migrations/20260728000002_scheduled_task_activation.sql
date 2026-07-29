-- "Activate tomorrow": a planned (inactive) Task can be scheduled to turn
-- itself on the next time the player opens the app on or after that date,
-- instead of requiring an immediate manual Reactivate. Follows the same
-- on-read pattern as decay/Good Day backfill (CLAUDE.md build order) --
-- no cron needed, just checked whenever Today/Manage loads.
alter table tasks add column scheduled_activation_date date;
