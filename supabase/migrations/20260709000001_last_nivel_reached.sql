-- Nested Nivel system (design doc Section 7.5, CLAUDE.md Core formula #8).
-- Tracks the highest Nivel reached in the player's *current* Chapter, so the
-- app can detect exactly when a new threshold is crossed and fire the
-- celebration once. Resets to 0 whenever the player advances to a new
-- Chapter (handled in application code, not here).
alter table players
  add column last_nivel_reached integer not null default 0;
