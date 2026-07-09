-- Retire the Tutorial phase (design decision, this session): with the
-- Chapter-up gate now Good-Day-only and Nivel now XP-driven from Chapter 1
-- onward, Tutorial's two original justifications (no XP-gating, fast first
-- reward) are already true of Chapter 1 -- it no longer does anything
-- Chapter 1 doesn't. Players start directly at Chapter 1.

update players set current_level = 1 where current_level = 0;

alter table players drop column tutorial_complete;
