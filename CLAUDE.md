# Game of Life — Project Instructions for Claude Code

## What this is

A personal RPG for sustainable life growth — NOT a productivity app. It rewards effort, balance, consistency, exploration, and sustainable growth. It does NOT reward burnout, infinite optimization, overloading, or grinding one life area at the expense of others.

**The single question every feature must answer:** "How much responsibility can this person sustainably handle?" — never "how productive is this person?"

Full design rationale lives in `docs/game_design.md` (the complete design doc — reference it for *why*, this file is the *what to build*).

---

## Tech stack (locked — do not deviate without asking)

- **Framework:** Next.js (React + TypeScript), App Router
- **Styling:** Tailwind CSS
- **Database:** Supabase (hosted Postgres) — personal single-user app, so **no auth system** needed yet
- **Hosting:** Vercel
- **State:** Server components + React state; no heavy client state library needed at this scale

---

## MVP SCOPE — build this first, nothing more

Do NOT implement the full 15-chapter system, Mastery Phase, or all 5 Main Areas' full weight curves in the first pass. Build in this order:

**Phase 1 (current target):**
- Chapters 1, 2, 3 only (Milestone: Stability). Tutorial ("Awakening") is retired — players start at Chapter 1 (Section 7, revised).
- ONE active Path per player at a time (player picks or authors custom — see Goal structure below)
- Core loop: log a Task → see today's Good Day % → accumulate Good Days + XP → check chapter-up gate
- Simplified decay is OK for v1 (exact formula below, but don't over-engineer the UI around it yet)

**Explicitly OUT of scope until Phase 1 is working and tested:**
- Chapters 4–15, Mastery Phase, MP/Titles/Tiers, multiple simultaneous Goals, Side Quest bonus-XP routing, overflow XP curve (can hardcode "no overflow yet" — just cap XP at the daily ceiling for now)
- **The Ship visual system (design doc Section 10) has a corrected implementation note — read Section 10.7.** A basic version (simple flat-vector SVG shapes per construction stage) is buildable directly in code now; it does NOT require external illustration first. That said, it's still not part of the current Phase 1 MVP build order below — use a simple placeholder (a toast/banner reading "Nivel up!" or "Chapter complete!") for now, and build the real Ship as a deliberate next phase, not because it's blocked on missing assets.

### Terminology update (this session)

What was previously called "Level" throughout the codebase and UI is now called **Chapter** (Capítulo) in all player-facing text. **Do not rename the underlying database column** (`current_level` stays as-is — renaming it is an unnecessary migration risk for a naming-only change). Just update UI labels/copy from "Level" to "Chapter", and any new code added going forward should use "chapter" in variable/function names for anything new, while leaving already-working existing code alone unless you're touching that specific area anyway.

**Micro-milestones (previous Section 8 below) are retired — replaced by the new nested Nivel system (Section 8, rewritten below).** If micro-milestone logic was already implemented, remove it in favor of the new system. If it was only in this planning file and not yet built, simply build the new system instead — nothing to remove.

---

## Data model

```
Area (fixed, seed data — 5 rows, never player-editable)
  id, name  → Physical Health | Career | Mental Health | Relationships | Exploration
  is_foundation: boolean       → true for Physical Health + Mental Health

Player (single row for MVP — no multi-user yet)
  id, current_level (1, 2, 3... — Tutorial/level 0 retired, players start at 1)
  lifetime_good_day_count, cumulative_xp, last_nivel_reached
  created_at

AreaCapacity (one row per Player × Area)
  player_id, area_id, capacity (float, 0-100 scale)
  last_activity_date        → drives decay calc
  decay_cycle_start_date     → null unless currently decaying

Goal
  id, player_id, area_id (primary area), secondary_area_ids (array, optional)
  title, status: 'draft' | 'active' | 'completed' | 'abandoned'
  source: 'custom' | 'path_template', path_template_id (nullable)
  created_at

Milestone
  id, goal_id, title, order_index, status: 'active' | 'completed'

Task
  id, player_id, milestone_id (nullable — required if tier='main_task', optional otherwise)
  area_id, tier: 'main_task' | 'habit' | 'chore'
  title, recurrence: 'daily' | 'weekly' | 'custom'
  is_active: boolean

TaskLog (one row per completion)
  id, task_id, player_id, completed_date, xp_awarded

DailyGoodDay (one row per player per day, computed at day-rollover)
  player_id, date
  habit_pct, main_task_pct, chore_pct   → each 0.0-1.0
  good_day_pct                          → weighted sum, see formula below
  is_good_day: boolean                  → good_day_pct >= 0.80
```

**Validation rule (critical — closes a real design gap):** a Task can only be tier = `main_task` if `milestone_id` is NOT null AND that milestone's Goal has `status = 'active'`. Enforce this at the database level (check constraint or trigger) AND in the UI (don't let the user select "Main Task" tier without picking a Milestone first). Habits and Chores never require a milestone_id.

---

## Core formulas — implement exactly as specified

### 1. Tier XP values (universal ratios, all areas)
```
MAIN_TASK_MULTIPLIER = 4.0
HABIT_MULTIPLIER     = 2.5
CHORE_MULTIPLIER     = 1.0
```
(Side Quest tier and its Bonus-XP routing: skip for MVP — not in scope yet.)

### 2. Good Day % (per-category, NOT pooled)
For each day, compute completion % per category (1.0 if all due items for that category were done, 0.0 if none, proportional if partial — e.g. 1 of 2 due Main Tasks done = 0.5):

```
good_day_pct = (habit_pct * 0.40) + (main_task_pct * 0.40) + (chore_pct * 0.20)
is_good_day  = good_day_pct >= 0.80
```

If a category has zero items due that day, treat that category's completion as 1.0 (don't penalize for a category with nothing scheduled).

### 3. Area weights by level (Levels 1-3 only needed for MVP)
```
Level 1: Physical=0.340, Mental=0.340, Career=0.107, Relationships=0.107, Exploration=0.107
Level 2: Physical=0.340, Mental=0.340, Career=0.107, Relationships=0.107, Exploration=0.107
Level 3: Physical=0.337, Mental=0.337, Career=0.109, Relationships=0.109, Exploration=0.109
```
(Full 1-15 smootherstep formula is in the design doc, Section 4.2 — implement the general formula, not just a lookup table, so Levels 4+ work later without rework:)
```
t = (level - 1) / 14
ease = t³ * (t * (6t - 15) + 10)
foundation_weight = 0.34 + (0.22 - 0.34) * ease
other_weight = (1 - 2 * foundation_weight) / 3
```

### 4. Per-area daily XP ceiling
```
global_daily_cap(level):  Level 1 = 41, Level 2 = 41, Level 3 = 42
  (general formula: interpolate 41 → 84 across levels 1-15 via same smootherstep ease)

per_area_ceiling(level, area) = global_daily_cap(level) * area_weight(level, area)
```
Example: Level 1 Physical Health ceiling = 41 × 0.34 ≈ 14 XP/day.

### 5. Capacity per level (Levels 1-3 only needed for MVP)
```
Level 1: capacity = 10, decay_floor = 8
Level 2: capacity = 10, decay_floor = 8
Level 3: capacity = 12, decay_floor = 10
```
(General formula for later levels: `capacity = 10 + 90 * ease` using the same `ease` from #3. `decay_floor = capacity * 0.82`.)

### 6. Decay (per AreaCapacity row)
```
GRACE_DAYS = 3
DECAY_RATE = 0.005   // 0.5% per day, compounding
TIER_CAP_LOSS = 0.18 // never lose more than 18% of capacity in one neglect cycle

// "last_activity_date" = the most recent date ANY Task (Habit, Main Task, OR
// Chore) was completed in this area. Do NOT restrict this to Habits only —
// any completed task in the area counts as engagement and resets the clock.

days_since_activity = today - last_activity_date
if days_since_activity <= GRACE_DAYS:
    capacity stays at current value (no decay)
else:
    decay_days = days_since_activity - GRACE_DAYS
    floor = max(capacity_at_level * (1 - TIER_CAP_LOSS), previous_milestone_floor)
    new_capacity = max(capacity_at_level * (1 - DECAY_RATE) ** decay_days, floor)

// Re-engagement bonus ONLY fires if the return follows a GENUINE lapse —
// i.e. days_since_activity at the time of the completing task was > GRACE_DAYS.
// A routine 1-2 day gap within the grace window does NOT trigger this bonus;
// it exists specifically to subsidize recovering from a real setback.
if (days_since_activity_before_this_completion > GRACE_DAYS):
    re_engagement_bonus_xp = 1.0 * per_area_ceiling(level, area)  // 1x normal daily XP for that area
```

**Day boundary:** a "day" for all date-diffing above (decay, Good Day rollover, rolling windows) is midnight-to-midnight in the player's local timezone. Simplest reasonable default for a single-user app.

### 7. Good Day → Chapter-up gate (REVISED this session — Good-Day-only, no Tutorial)

**Tutorial is retired.** Players now start directly at Chapter 1 — its two original justifications (no XP-gating, fast first reward) are already true of Chapter 1 under this revised design, so it no longer did anything Chapter 1 doesn't. Do not reintroduce a Level/Chapter 0.

**The Chapter-up gate no longer checks XP at all** — XP now drives Nivel instead (Section 8, revised below). This was a deliberate, explicitly-confirmed design change: the original hybrid gate existed to prevent "front-loading" (leveling via Good Days alone, without real effort), but Good Day % itself already requires meaningful Habit + Main Task completion to clear 80% (Section 2 formula) — a pure-Chore day caps at 20%. That existing protection was judged sufficient without a second, separate XP gate.

```
Chapter 1/2/3: rolling_window = 14 days, rate_floor = 0.50

Chapter-up requires ALL of:
  1. lifetime_good_day_count >= gd_threshold   (Ch.1: 10 cumulative, Ch.2: 25 cumulative, Ch.3: 40 cumulative)
  2. (good_days_in_last_14_days / 14) >= 0.50
```

(Cumulative thresholds recomputed without the old Tutorial's 7 GD prefix: Chapter 1's own requirement is 10, Chapter 2 adds 15 more → 25 cumulative, Chapter 3 adds 15 more → 40 cumulative.)

### 8. Nested Nivel system (REVISED this session — now XP-driven, not Good-Day-driven)

Within each Chapter, a finer-grained "Nivel" fires on an exponential curve based on cumulative **XP** *within the current Chapter only* (resets to 0 when a new Chapter starts). This was changed from Good-Day-driven so Nivel tracks the Effort axis while the Chapter gate tracks the Balance axis — two independent, legible motivators (Section 2: "Effort without balance does not level the player. Balance without effort does not level the player").

```
G = XP required for the current Chapter (Ch.1: 450, Ch.2: 700, Ch.3: 700 — the existing XP-per-level table)
N = number of Niveles in this Chapter = max(4, round(sqrt(G) * 0.24))
  — coefficient recalibrated for XP-sized G (450-700+), NOT the old Good-Day coefficient (1.6),
    which would yield absurd results (e.g. 34 Niveles) at XP magnitudes

Cumulative XP needed for Nivel n (of N) = round(G * (n/N)^1.4)

Actual thresholds (computed, not hand-picked):
  Chapter 1 (G=450, N=5): Nivel-ups at 47, 125, 220, 329, 450 cumulative XP within the chapter
  Chapter 2 (G=700, N=6): Nivel-ups at 57, 150, 265, 397, 542, 700
  Chapter 3 (G=700, N=6): same shape as Chapter 2
```

**Nivel is checked in real time, at the moment XP is awarded (task completion), not deferred to the next-day Good Day backfill** — unlike the old Good-Day-driven version, XP is available immediately, so there's no reason to wait.

**A player can max out Nivel before the Chapter's Good-Day gate clears (or vice versa) — this is intentional, not a bug.** The two axes are independent by design; reaching max Nivel while Good Days lag communicates "you've put in the effort, now live it consistently" exactly per Section 2's stated philosophy. Both progress bars are visible together, so the player always sees why they're waiting.

**What a Nivel-up does:** visual-only reward (currently a placeholder toast, see MVP scope note above — Ship rendering comes later). **No separate XP is awarded** — the underlying task completion already granted the XP. Track a `last_nivel_reached` value on `Player` (already implemented) so the app can detect *when* a new Nivel threshold is crossed and fire the celebration moment exactly once. Reset it to 0 whenever the Chapter advances.

**Goal/Path continuity:** unaffected by the Tutorial's removal — a player's active Goal/Path simply continues across Chapter transitions as before.

### 9. Task Activation Delay (NEW this session)

A newly created Task earns full Growth XP starting the day **after** it's created, not the same day. No fixed clock window (e.g. NOT "only plan 8-10pm") — that would punish a single missed window the same way a fragile streak does. Just: `created_date + 1 day` = when full Growth XP eligibility begins.

```
if task.created_date == today:
    completing it today → awards BONUS XP (same channel as Side Quest bonus XP,
    NOT full tier XP) — feeds Mastery/overflow, not Growth-phase leveling
else:
    completing it → awards normal tier XP as usual (formula #1)
```

**Exemption:** tasks seeded from a Path template (e.g. "Just Stabilize") are exempt — mark them with a `source = 'path_template'` flag (already in the Task/Goal data model) and skip the activation delay check for those. This preserves full XP from Day 1 for a brand-new Chapter 1 player.

**New seeded system Habit — "Planned tomorrow":** always available to every player, no `milestone_id` required, standard Habit-tier XP (2.5×) when completed. Not player-created — seed it alongside the 5 Areas and Just Stabilize Path in the database seed step.

---

## UX principles (don't violate these while building)

1. **Capacity is hidden.** Never show the raw Capacity number or decay % directly in the UI. It's a backend variable that determines ceilings and Good Day math — the player feels its effects, doesn't see the stat.
2. **Show XP live — but NOT Good Day %.** These are governed by different rules, don't conflate them:
   - **Immediate per-action feedback (NEW this session):** every completed Task shows an instant "+X XP" moment (using the tier values from formula #1). A running **"XP today" counter is also shown live**, updating as the day progresses.
   - **Good Day % stays hidden, revealed only at day-rollover.** Never show the live percentage or a progress bar ticking toward the 80% threshold. Reasoning: Good Day % has a specific pass/fail cliff (80%) that invites gaming if visible live ("just need a bit more to hit 80%"). XP has no such cliff — it simply accumulates with nothing to optimize *toward* — so showing XP live doesn't reintroduce that problem. Don't generalize "hide it live" from Good Day % to XP; they're different cases for a specific, stated reason.
3. **Every player must have ≥1 active Goal.** For Chapter 1, offer the "Just Stabilize" Path as a one-tap option — never force blank-page goal authoring on a new player (this is a deliberate accessibility decision, see design doc Section 8.3).
4. **The "Just Stabilize" Path (MVP's default/starter Path) — seed this as real data:**
   - Area: Physical Health (primary) + Mental Health (secondary)
   - Milestone 1: "Maintain sleep routine for 2 weeks"
   - Milestone 2: "Leave the house 3×/week"
   - Tasks: "Sleep on schedule" (Habit), "Go for a short walk" (Habit), "Text one friend back" (Main Task, linked to Milestone 2)

---

## Build order for this session

1. Scaffold Next.js + Tailwind + Supabase connection
2. Create the schema above as Supabase tables/migrations
3. Seed the 5 Areas + the "Just Stabilize" Path template
4. Build the daily Task-logging UI (list today's due Habits/Main Tasks/Chores, mark complete)
5. Implement the Good Day % calculation (server-side, runs at day-rollover or on-demand)
6. Implement XP accrual + the Chapter-up gate check
7. Implement decay (can be a scheduled/cron check or computed on-read — on-read is simpler for MVP)
8. Simple "Today" view + a basic Chapter/XP progress display (visible) — no Capacity display (hidden per UX principle #1)

## This session's specific task (if Phase 1 above is already built)

1. Update all player-facing UI text: "Level" → "Chapter" (no database column rename)
2. Check whether micro-milestone logic (old Section 8) was already implemented — if yes, remove it; if no, skip straight to step 3
3. Implement the new nested Nivel system (Section 8 above) — add the `last_nivel_reached` tracking field, compute Nivel thresholds per the formula, fire a simple placeholder celebration (toast/banner) on Nivel-up — no Ship graphics yet

## New design additions (design doc Sections 11-13) — NOT yet ready to build

Three new systems were designed in a later session:

1. **Nivel Chest System** (design doc Section 11) — every Nivel-up awards a chest with guaranteed construction materials + scaling MP. Exact formula is locked (see Section 11), but exact cosmetic prices and the full purchase catalog are explicitly deferred to a dedicated balance-focused session.
2. **Avatar system** (design doc Section 12) — separate from the Ship, human character customization. Full taxonomy is locked (gender, skin tone, hair style/color, eye color as free base identity; top/bottom/shoes/accessories as MP-earnable separate layers). **Default Character Archetype is now confirmed: Explorer/Cartographer** (Section 12.3) — this unblocks building a concrete first Avatar + Ship design once this phase of work starts. Other archetypes (Pirate, Naval Officer, Merchant Captain) are deferred as fast follow-ups after the default is validated — do not build them yet.
3. **Onboarding Flow** (design doc Section 13) — the full 4-step new-player sequence (narrative hook → Avatar creation → Path/Goal selection → transition to Today) is fully detailed, screen-by-screen, including exact copy. Not yet implemented.

**Do not implement any of these three yet.** All have concrete formulas/specs locked, but building them now would mean building on top of pricing/catalog decisions (#1) or a Ship implementation (#2, #3 — the Onboarding Flow's Step 4 specifically needs at least a basic Ship to exist) that hasn't been started. Flag this to Gus if asked to build these — check whether the Ship's basic version (see note below) and the balance-focused pricing session have happened before proceeding.

**Ship implementation status — corrected, do not follow outdated guidance:** an earlier instruction in this file said to defer all Ship rendering until external illustration assets exist. **That guidance was wrong and has been corrected** (design doc Section 10.7) — the flat vector art style was deliberately chosen because Claude Code can build it directly in code (SVG/CSS) right now, without needing external illustration. If/when Ship or Avatar visuals become the active task, build simple geometric SVG shapes directly — don't wait for external art, and don't defer this the way earlier guidance mistakenly suggested.

Ask before adding anything not listed above. When in doubt about a formula or a rule not covered here, check `docs/game_design.md` before guessing.
