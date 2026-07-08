-- players.cumulative_xp was typed integer, but Habit-tier XP is 2.5 (see
-- CLAUDE.md "Tier XP values") and Main Task/Chore ceilings can produce
-- fractional remainders too. Widen to match task_logs.xp_awarded's precision.
alter table players
  alter column cumulative_xp type numeric(9, 2) using cumulative_xp::numeric(9, 2);
