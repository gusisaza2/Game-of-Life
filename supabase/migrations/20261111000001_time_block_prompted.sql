-- "Your work block ended" prompt: when the player opens the app after a
-- planned block's time has passed, Today asks once what happened (worked on
-- it / reschedule / delete). prompted_at records that the question was already
-- put to the player for this slot, so it's asked once -- across every device --
-- and not on every open. Moving a block to a new time clears it, because the
-- new slot is a new occasion to ask about.
--
-- Nothing else changes: a block still awards no XP and never completes its task.
alter table time_blocks add column if not exists prompted_at timestamptz;
