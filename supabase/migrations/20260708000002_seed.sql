-- Game of Life — seed data (Phase 1 / MVP)
-- 5 fixed Areas, the single Player row, starting AreaCapacity rows, and the
-- "Just Stabilize" starter Path (CLAUDE.md "UX principles" #4).

insert into areas (name, is_foundation) values
  ('Physical Health', true),
  ('Mental Health', true),
  ('Career', false),
  ('Relationships', false),
  ('Exploration', false);

do $$
declare
  v_player_id uuid;
  v_physical_id uuid;
  v_mental_id uuid;
  v_goal_id uuid;
  v_milestone_1_id uuid;
  v_milestone_2_id uuid;
begin
  select id into v_physical_id from areas where name = 'Physical Health';
  select id into v_mental_id from areas where name = 'Mental Health';

  insert into players (current_level, tutorial_complete, lifetime_good_day_count, cumulative_xp)
  values (0, false, 0, 0)
  returning id into v_player_id;

  -- Starting Capacity for every area (Level 1 value, see CLAUDE.md "Capacity per level").
  insert into area_capacities (player_id, area_id, capacity)
  select v_player_id, id, 10
  from areas;

  -- "Just Stabilize" Path — every player needs >=1 active Goal (CLAUDE.md
  -- UX principle #3); this is the one-tap default for Level 1/Tutorial.
  insert into goals (player_id, area_id, secondary_area_ids, title, status, source, path_template_id)
  values (v_player_id, v_physical_id, array[v_mental_id], 'Just Stabilize', 'active', 'path_template', 'just_stabilize')
  returning id into v_goal_id;

  insert into milestones (goal_id, title, order_index, status)
  values (v_goal_id, 'Maintain sleep routine for 2 weeks', 1, 'active')
  returning id into v_milestone_1_id;

  insert into milestones (goal_id, title, order_index, status)
  values (v_goal_id, 'Leave the house 3x/week', 2, 'active')
  returning id into v_milestone_2_id;

  insert into tasks (player_id, milestone_id, area_id, tier, title, recurrence, is_active)
  values
    (v_player_id, null, v_physical_id, 'habit', 'Sleep on schedule', 'daily', true),
    (v_player_id, null, v_physical_id, 'habit', 'Go for a short walk', 'daily', true),
    (v_player_id, v_milestone_2_id, v_mental_id, 'main_task', 'Text one friend back', 'weekly', true);
end $$;
