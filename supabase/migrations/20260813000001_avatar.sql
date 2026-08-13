-- Avatar base identity (design doc Section 12.2): chosen once, free, at
-- creation. Only base identity for this pass -- MP-earnable clothing
-- layers (top/bottom/shoes/accessories) are explicitly deferred until the
-- Nivel Chest System's pricing/catalog session happens (CLAUDE.md).
-- Single-player MVP, so this lives directly on players rather than a
-- separate table, same convention as current_level/cumulative_xp.
alter table players add column avatar_gender text not null default 'male'
  check (avatar_gender in ('male', 'female'));
alter table players add column avatar_skin_tone text not null default 'medium';
alter table players add column avatar_hair_style text not null default 'short'
  check (avatar_hair_style in ('short', 'long', 'bald'));
alter table players add column avatar_hair_color text not null default 'black';
alter table players add column avatar_eye_color text not null default 'brown';
