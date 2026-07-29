-- Habit Streak: per-Habit consecutive-day tracking, independent of Good
-- Days/Chapter, whose milestone XP feeds the same cumulative_xp pool that
-- already drives Nivel (design discussion: single XP economy, no parallel
-- currency). Missing a day resets current_streak with no grace period;
-- longest_streak preserves the historical best separately so a reset
-- doesn't erase it. last_streak_milestone_reached mirrors last_nivel_reached
-- (tracks which threshold's XP has already been paid this streak) and
-- resets to 0 whenever current_streak resets, so rebuilding a streak can
-- earn the same thresholds again.
alter table tasks add column current_streak integer not null default 0;
alter table tasks add column longest_streak integer not null default 0;
alter table tasks add column last_streak_date date;
alter table tasks add column last_streak_milestone_reached integer not null default 0;

-- Reversibility for streak state, same pattern as the AreaCapacity/
-- re-engagement-bonus fix: snapshot what a completion is about to
-- overwrite, plus any streak-milestone XP awarded, so un-completing can
-- restore both precisely.
alter table task_logs add column streak_xp_awarded numeric(9, 2) not null default 0;
alter table task_logs add column prev_current_streak integer;
alter table task_logs add column prev_longest_streak integer;
alter table task_logs add column prev_last_streak_date date;
alter table task_logs add column prev_last_streak_milestone_reached integer;
