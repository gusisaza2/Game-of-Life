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
- **The literal Ship-construction-scene visual (design doc Section 10.1/10.5-10.7) is superseded by the Voyage Map (design doc Section 18) — and the Voyage Map itself is now built, at both scales.** See the running log below ("Voyage Map...") for what's shipped: a macro map (Capítulos 1-15, reachable from Today's "Voyage →" link) and a micro version on each Goal card that replaced the old flat Milestone progress bar. **Note the macro map is a browsable status view only, not an active celebration** — no toast/banner has actually been built for the moment a Chapter advances (the "Chapter complete!" placeholder this note used to point to was never implemented either); `current_level` just increments silently and the Voyage Map reflects it next time it's opened. If/when a real Chapter-up celebration is built, it should highlight/point at this map rather than inventing a separate visual. The Area → Ship Part mapping (Section 10.2) is NOT retired — it's shipped as `AreaIcon.tsx`'s icon glyphs, reused inside the Voyage Map's own nodes.

### Terminology update (Level → Chapter, completed)

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

### 7. Good Day → Chapter-up gate (Good-Day-only, no Tutorial — implemented)

**Tutorial is retired.** Players now start directly at Chapter 1 — its two original justifications (no XP-gating, fast first reward) are already true of Chapter 1 under this revised design, so it no longer did anything Chapter 1 doesn't. Do not reintroduce a Level/Chapter 0.

**The Chapter-up gate no longer checks XP at all** — XP now drives Nivel instead (Section 8, revised below). This was a deliberate, explicitly-confirmed design change: the original hybrid gate existed to prevent "front-loading" (leveling via Good Days alone, without real effort), but Good Day % itself already requires meaningful Habit + Main Task completion to clear 80% (Section 2 formula) — a pure-Chore day caps at 20%. That existing protection was judged sufficient without a second, separate XP gate.

```
Chapter 1/2/3: rolling_window = 14 days, rate_floor = 0.50

Chapter-up requires ALL of:
  1. lifetime_good_day_count >= gd_threshold   (Ch.1: 10 cumulative, Ch.2: 25 cumulative, Ch.3: 40 cumulative)
  2. (good_days_in_last_14_days / 14) >= 0.50
```

(Cumulative thresholds recomputed without the old Tutorial's 7 GD prefix: Chapter 1's own requirement is 10, Chapter 2 adds 15 more → 25 cumulative, Chapter 3 adds 15 more → 40 cumulative.)

### 8. Nested Nivel system (XP-driven, not Good-Day-driven — implemented)

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

### 9. Task Activation Delay (implemented)

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

### 10. Habit Streak (implemented)

Per-Habit consecutive-day tracking, shown as a circular ring on Today, independent of Good Days/Chapter/Tasks. Only `tier = 'habit'` tasks have one. Its milestone XP feeds the same `cumulative_xp` pool that drives Nivel — deliberately a single XP economy, not a parallel currency (design discussion: rejected a separate/capped channel in favor of calibrating the payout against the existing per-area ceiling instead).

```
current_streak, longest_streak, last_streak_date, last_streak_milestone_reached  → per Task (habit tier only)

STREAK_GOAL_DAYS = 21   // the ring visually caps here; the streak itself (and its
                        // XP milestones) keep going past 21 for as long as it holds

// Missed day → current_streak resets to 0 with NO grace period (explicit
// design choice, distinct from AreaCapacity's decay grace window).
// longest_streak preserves the historical best separately, so a reset never
// erases it. last_streak_milestone_reached resets to 0 alongside
// current_streak, so rebuilding a broken streak can re-earn the same
// thresholds again (not exploitable — rebuilding still costs the same real days).
// Computed on-read (same pattern as decay/Good Day backfill) so a broken
// streak shows as broken the moment the app opens, before any completion.

Milestone thresholds (day → multiplier of that habit's per_area_ceiling(level, area)):
  5 days   → 1x
  10 days  → 2x
  15 days  → 3.5x
  21 days  → 5x (streak goal complete)
  beyond 21: next_day = day + round(gap), next_multiplier = multiplier * 1.2,
             gap *= 1.2, starting gap = 9 (so 21 → 30 → 41 → 54 → 70 → 89 → 111...)
  // ×1.2 was chosen after simulating ×1.5, which let a single milestone's
  // payout exceed an entire Chapter's total XP budget (450 for Chapter 1)
  // within a plausible streak length — ×1.2 stays under that even on very
  // long streaks, so one Habit Streak milestone never trivializes Nivel's pacing.

xp_for_milestone = round(multiplier * per_area_ceiling(level, area), 2)
// Uncapped by the daily area ceiling (like the re-engagement bonus) — it's
// a milestone achievement, not a daily completion.
```

**Reversibility:** un-completing a Habit the same day reverses both the streak increment and any milestone XP awarded, restoring the task's prior streak state exactly (same snapshot-on-task_log pattern used for AreaCapacity/re-engagement-bonus reversibility).

**Chapter Missions — explicitly deferred, NOT built.** An earlier idea (3-4 required "quest" objectives per Chapter, gating advancement, separate from Habit Streak) was discussed and set aside: it would have reintroduced a hybrid Chapter-up gate right after that was deliberately simplified to Good-Day-only (Section 7 above), and risked stacking three concurrent required systems (Good Days + Nivel + Missions) against the "sustainable, not overloading" design pillar (Section "What this is"). If revisited, it should be **optional** bonus objectives that reward but never block Chapter advancement — see chat history for the fuller discussion before building this.

---

## UX principles (don't violate these while building)

1. **Capacity is hidden.** Never show the raw Capacity number or decay % directly in the UI. It's a backend variable that determines ceilings and Good Day math — the player feels its effects, doesn't see the stat.
2. **Show XP live — but NOT Good Day %.** These are governed by different rules, don't conflate them:
   - **Immediate per-action feedback (implemented):** every completed Task shows an instant "+X XP" moment (using the tier values from formula #1). A running **"XP today" counter is also shown live**, updating as the day progresses. Task completion itself is optimistic (see "Optimistic UI" below) — the checkbox/ring flips before the server confirms, but the XP number always waits for the real server value.
   - **Good Day % stays hidden, revealed only at day-rollover.** Never show the live percentage or a progress bar ticking toward the 80% threshold. Reasoning: Good Day % has a specific pass/fail cliff (80%) that invites gaming if visible live ("just need a bit more to hit 80%"). XP has no such cliff — it simply accumulates with nothing to optimize *toward* — so showing XP live doesn't reintroduce that problem. Don't generalize "hide it live" from Good Day % to XP; they're different cases for a specific, stated reason.
3. **Every player must have ≥1 active Goal.** For Chapter 1, offer the "Just Stabilize" Path as a one-tap option — never force blank-page goal authoring on a new player (this is a deliberate accessibility decision, see design doc Section 8.3).
4. **The "Just Stabilize" Path (MVP's default/starter Path) — seed this as real data:**
   - Area: Physical Health (primary) + Mental Health (secondary)
   - Milestone 1: "Maintain sleep routine for 2 weeks"
   - Milestone 2: "Leave the house 3×/week"
   - Tasks: "Sleep on schedule" (Habit), "Go for a short walk" (Habit), "Text one friend back" (Main Task, linked to Milestone 2)

---

## Build order (original Phase 1 build, completed)

1. Scaffold Next.js + Tailwind + Supabase connection
2. Create the schema above as Supabase tables/migrations
3. Seed the 5 Areas + the "Just Stabilize" Path template
4. Build the daily Task-logging UI (list today's due Habits/Main Tasks/Chores, mark complete)
5. Implement the Good Day % calculation (server-side, runs at day-rollover or on-demand)
6. Implement XP accrual + the Chapter-up gate check
7. Implement decay (can be a scheduled/cron check or computed on-read — on-read is simpler for MVP)
8. Simple "Today" view + a basic Chapter/XP progress display (visible) — no Capacity display (hidden per UX principle #1)

## Terminology-update session's task (completed)

1. Update all player-facing UI text: "Level" → "Chapter" (no database column rename)
2. Check whether micro-milestone logic (old Section 8) was already implemented — if yes, remove it; if no, skip straight to step 3
3. Implement the new nested Nivel system (Section 8 above) — add the `last_nivel_reached` tracking field, compute Nivel thresholds per the formula, fire a simple placeholder celebration (toast/banner) on Nivel-up — no Ship graphics yet

## New design additions (design doc Sections 11-13, 18, 20) — status per item

Three new systems were designed together in one session; the Voyage Map (Section 18) came later and is now fully built (see running log below). Current status:

1. **Nivel Chest System** (design doc Section 11) — **still not built.** Every Nivel-up would award a chest with guaranteed construction materials + scaling MP; the formula is locked, but exact cosmetic prices and the full purchase catalog are explicitly deferred to a dedicated balance-focused session. Don't build without that session happening first.
2. **Avatar system** (design doc Section 12) — **base identity + Growth Rings are built** (running log: "Avatar system + Avatar Growth Rings"). Gender, skin tone, hair style/color, and eye color are free, chosen at creation, and editable anytime from the Avatar badge on Today; the 5 per-Area Growth Rings (Section 20) are live and computed from real XP. **Still not built, both still blocked:** the MP-earnable clothing layers (top/bottom/shoes/accessories) — blocked on the Chest System's pricing/catalog (#1) — and the additional Character Archetypes (Pirate, Naval Officer, Merchant Captain), deliberately deferred as a fast-follow after the default (Explorer/Cartographer) was validated. No archetype-selection UI exists yet; the shipped Avatar has no archetype framing applied to it at all.
3. **Onboarding Flow** (design doc Section 13) — **still not built.** The full 4-step new-player sequence (narrative hook → Avatar creation → Path/Goal selection → transition to Today) is fully detailed with exact copy, but Steps 1 and 4 (Section 13.3, 13.6) still describe the now-superseded literal Ship-construction scene. **These need to be rewritten against the Voyage Map (Section 18) before this is buildable** — not just implemented as originally written. Flag this to Gus if asked to build Onboarding.

**Ship implementation status:** the Ship as a literal environmental progress scene is superseded by the Voyage Map (see MVP scope note above) — don't build it. The Area → Ship Part icon mapping (Section 10.2) is a separate thing and already shipped via `AreaIcon.tsx`. Lesson worth carrying into the still-unbuilt pieces above: the Avatar, the Voyage Map's nodes, and every Area icon were all built as flat-vector SVG directly in code, no external illustration needed — do the same for the Chest System's icons and the Avatar's clothing layers when those are eventually built, rather than waiting on external art.

---

## Implemented since Phase 1 (running log, newest first — keep this current)

### Installable app (PWA): own icon on the computer and a proper one on the phone
Gus had the app on his phone as a plain shortcut (the project had **no manifest and no icons** beyond the scaffold's generic `favicon.ico`, so it showed a default letter/screenshot icon) and wanted it on his computer too. Now it's an installable web app:
- `src/app/manifest.ts` (served at `/manifest.webmanifest`): name "Game of Life", `display: standalone` (its own window, no browser bar), `start_url`/`scope` `/`, mint `background_color` and teal `theme_color` from the app's palette, icons 192/512 (`any`) and a 512 `maskable`. `layout.tsx` adds `appleWebApp` (iPhone home-screen title/mode) and a `viewport.themeColor`.
- **Icon artwork** is the Voyage Map's hexagon node with a winding path climbing to an amber node, drawn as SVG in `scripts/generate-icons.mjs` and rendered with `sharp` (already in `node_modules`) to `public/icons/*.png`, `src/app/icon.png`, `src/app/apple-icon.png` and a PNG-in-ICO `src/app/favicon.ico` (replacing the scaffold's). The outputs are committed; re-run `node scripts/generate-icons.mjs` only if the artwork changes. Two flavors on purpose: **`any`** = rounded square with margin (what macOS Dock/Chrome show as-is) and **full-bleed opaque** for the apple-touch-icon (iOS rounds it itself and paints transparency black) and `maskable`.
- **No service worker, deliberately:** the app is all live data (Supabase, on-read refreshes, the clock), so caching pages offline would only risk showing stale state. It needs an internet connection, same as before. If Chrome ever refuses to offer "Install" for lack of one, a minimal pass-through worker is the fix — not an offline cache.
- Install on a Mac: Chrome/Edge — the install icon in the address bar (or menu → "Install Game of Life"); Safari 17+ — File → "Add to Dock". On the phone, remove the old shortcut and add it again (iOS caches the icon it first saw).

### Agenda window (`/agenda`): day + week views, move anything, "Something came up", live clock
Where events and work blocks get **adjusted** when life intervenes (`/plan` is where they're created, Today is where the day is lived). Built with Gus's approval of: Day + Week views, and the "Something came up" button. **No migration** — it only updates `events` and `time_blocks`.
- **Day view** (`AgendaView.tsx`, `DayTimeline`): a vertical hour timeline (7am to midnight — the last line reads "12 AM" — and it starts earlier only if something begins before 7am), events and blocks as boxes sized by duration (1 px/min), overlapping ones side by side (`agenda-layout.ts`'s `layoutColumns`), past items faded, and a "now" line. **Week view:** seven day cards (Mon–Sun) with planned hours, a "Heavy" badge past 6 h, and the day's first items; tapping a day opens it. `?date=` / `?view=` params; browsable 14 days back and 90 ahead.
- **Live clock** (`src/lib/use-now.ts`, `useNow`): server components compute "now" once at render, so a page left open froze on that moment (Today's Agenda used to keep "can be marked once it starts" until reload). The hook starts from the server's value (so hydration matches), then follows the clock: ticks every 30 s, snaps to real time when the tab becomes visible again, and `router.refresh()`es when the day rolls over or the player returns to the tab. It reads the **fixed UTC-5 Bogota clock** from `today.ts`, not the device timezone, so the app agrees with itself wherever the phone is (a deliberate single-player assumption — if Gus ever travels and wants it to follow the device, that's a decision to make then). `AgendaSection.tsx` (Today) uses it too. Server actions still validate against the server's own clock, so a wrong device clock can't award XP early.
- **Tap an item → a bottom sheet** (`AgendaSheets.tsx`; portaled to `<body>` per the `template.tsx` containing-block lesson): for a **block** — +30 min, +1 hour, Tomorrow/Next day same time, Next free slot (`moveBlockToNextFree`: first gap that fits, today or the next days, skipping heavy days), manual day/time/duration with overlap warnings, Skip, Remove. For an **event** — new day/from/to, Cancel (`setEventStatus` cancelled). Moving an event returns its prep tasks that are now due on or after the event (`moveEvent` → `lateTasks`); the sheet offers "Move them to the day before" (`alignPrepDeadlines`). **The sheet keeps its own copy of the item** — moving an event to another day removes it from the viewed day, and with the item looked up from props the sheet unmounted before showing that warning (real bug found by testing).
- **"Something came up"** (`ReschedulePanel`, `proposeReschedule` / `applyBlockMoves`, pure logic in `reschedule.ts`'s `proposeMoves`): the player says when they're not available (presets "Rest of today"/"Next 2 hours"/"The whole day", or a custom range; on today it starts at the **current time**, and time already past is never re-planned). It lists the planned blocks in that window and **proposes** a new slot for each — first free gap after the window, same day if it fits before 9pm, else the following days up to a week out — never piling a day past the heavy-day line, never overlapping events or other blocks (including ones it just placed). Events in the window are listed but **never moved automatically** (they're fixed by someone else); each has a "Change" button. The player ticks which moves to apply; **nothing changes until they confirm**, and each move is revalidated server-side.
- **Verified** on real data: live clock advanced 4:05→4:06 PM without a reload matching real Bogota time; selective apply (one of two proposals) moved only that block; "Next free slot" skipped a 90-minute gap for a 2 h block; event move → prep deadline warning → aligned; the week view rendered Gus's real plan; mobile 375px has no overflow. Test data was marked and removed (`time_blocks.note = 'ZZ-test'`), and a before/after snapshot of XP, Area capacity, logs and real blocks matched. 20 unit cases cover `proposeMoves` / layout / week math.
- **Removing a block (asked for by Gus):** the block sheet always offers "Remove this block" (also for done blocks) and asks first — "Remove this work block?" with *Yes, remove it* / *Move to next free slot* (the reschedule alternative) / *Keep it*; the `/plan` row's Remove asks too. Removing never touches the task or XP (blocks award none).
- **Drag to move (asked for by Gus):** on the Day view, planned work blocks and scheduled events can be dragged vertically to a new time (`AgendaView.tsx`'s `ItemBox`; snaps to 15 min, keeps the duration, same day only, visible range only). A mouse drags on movement; a finger must **press and hold ~320 ms** first so normal scrolling still works (a non-passive `touchmove` listener blocks page scroll once a drag is on; the page auto-scrolls near the screen edges). The move is optimistic (`useOptimistic`), calls the existing `moveBlock` / `moveEvent`, and a note says where it landed or that it overlaps something (never blocked). Not draggable: past days, done blocks, events not "scheduled", items running past midnight. Moving to another day is still done from the tap-sheet. The click that ends a drag is suppressed so it doesn't open the sheet.
- **A drag can never get stuck (real bug found by Gus):** once a drag is active, `ItemBox` also listens on `window` for `pointerup`/`pointercancel`/`blur`/Escape (Escape and blur cancel; release commits), and a mouse move reporting `buttons === 0` ends it too — a release that lands outside the item or window used to leave the block glued to the cursor. The resize grip is 14–28 px tall (≈45% of a short item) because a thin one was untouchable on a phone.
- **Resize by the bottom edge (same gesture family):** every draggable item has a small grip at its bottom edge (`data-handle="resize"` in `ItemBox`); dragging it changes the duration in 15-min steps (minimum 15 min, up to the end of the visible timeline), keeping the start. Same mouse-vs-press-and-hold rules, same optimistic path (`moveBlock` with the new length / `moveEvent` with the new end), and the preview shows the new end time while dragging.
- **"Your work block ended" prompt (asked for by Gus):** on Today, when the app is opened after a *planned* block's time has passed (`end_time <= now`, or an earlier day) and the player hasn't been asked yet, `EndedBlockPrompt.tsx` shows a bottom sheet — one block at a time, "N more after this" — with **Completed** (marks the block done, then asks "Is the task finished?" with a link that scrolls to the task's row; a block never completes its task or awards XP), **Reschedule** (Next free slot / Tomorrow same time / Pick a time… via the existing `ItemSheet`) and **Delete** (confirms first, offers Reschedule instead). **Decide later** — or closing the sheet — records `time_blocks.prompted_at` (`markBlockPrompted`) so it's asked **once**, across every device; the block stays in Today's Agenda with its usual buttons and nothing is penalized. **Every action that moves a block to a new time clears `prompted_at`** (`moveBlock`, `applyBlockMoves`, `moveBlockToTomorrow`, plan page's `updateBlock`), because the new slot is a new occasion to ask. Migration `20261111000001_time_block_prompted.sql` (applied by Gus). Evaluated on the server at render, not live: a block that ends while the app is already open is asked about on the next open/refresh (returning to the tab refreshes via `useNow`). No push notification when a block ends — the app has no push.
- **Not built:** dragging across days (tap-to-move covers it), month view, Google Calendar sync, moving events automatically.

### Work blocks + the "Plan Tomorrow's Day" page (`/plan`)
Third concept next to Tasks and Events — each answers a different question: a **Task** is *what* has to be delivered by a date; an **Event** is *when* something fixed by someone else happens; a **work block** is *when the player chose to work on a task* ("tomorrow 4–6pm on Edit Magnolia"). Built with Gus's approval; his decisions: **blocks award no XP** (the task already pays on completion, and per-block XP would be farmable by scheduling many — instead the plan page shows time invested per task), **a heavy-day warning** past 6 planned hours (`HEAVY_DAY_MINUTES`; a soft message, never a block), **blocks don't count toward the Good Day** (same as events), **Chores are plannable too**, and **"Finish planning"** completes the seeded "Planned tomorrow" habit. Left out of v1: recurring blocks, Google Calendar sync.
- **Schema** (`supabase/migrations/20261109000001_time_blocks.sql`, applied by Gus in the SQL Editor): `time_blocks` (`task_id` → tasks `on delete cascade`, `block_date`, `start_time`, `end_time` with a DB check `end_time > start_time` — a block stays within one day, unlike an event — `status` planned/done/skipped, `resolved_on`, `note`). Plain local date/time, no timezone, same as events. The migration deliberately has no `drop` statement (Supabase's SQL Editor throws a scary "destructive operations" dialog on any `drop`, even `drop policy if exists`) — idempotency uses `do $$ ... exception when duplicate_object` instead.
- **A block never completes its task** — it only records that time was set aside and whether it was used (`setBlockStatus` done/skipped; `moveBlockToTomorrow` is one tap). No XP, no penalty. `src/lib/time-blocks.ts` holds the helpers (`endTimeFor`, `overlaps`, `firstFreeStart` — suggests the first gap in 09:00–21:00 that fits the duration, `plannedMinutes`); `src/app/plan/actions.ts` the server actions.
- **`/plan`** (`src/app/plan/page.tsx` + `src/components/PlanView.tsx`): defaults to tomorrow, ←/→ steps through days (today through +14; an invalid or past `?date=` falls back to tomorrow). Top: the day's timeline (events + blocks by time, "Overlap" badges, total planned, heavy-day warning). Below: every open, active Mission and Chore ("To plan"), sortable by **Due date** / **Goal** (grouped by Goal, "No goal" last) / **XP** (note: XP is just the tier value — Mission 4, Chore 1 — so it mostly separates tiers; in this sort each row also shows its Area's daily XP ceiling, e.g. Career ≈ 4.4/day, since planning several Missions in one Area can't earn more than the ceiling). "Plan time" opens start time + duration chips (30 min–3 h), pre-filled with the first free slot; overlaps are warned about, never blocked. Rows show "N h invested so far" (sum of that task's done blocks). A "Finish planning" bar reuses `useTaskCompletion` on the "Planned tomorrow" habit, so it's reversible like any completion.
- **On Today:** an **Agenda** now merges events and work blocks by time (`AgendaSection.tsx`'s `AgendaBlockItem`: "I worked on it" / "Move to tomorrow" / "Skip"; past planned blocks nobody marked ask "Did you work on it?"). **A task with a block today (or an unresolved one) shows on Today's list even if its deadline is far off, and leaves the Backlog** — planning it is what puts it in focus; this effectively replaces the manual "Foco" star idea. "Plan →" in Today's header links to the page.
- **Verified** against real data with before/after snapshots (XP, Area capacity, logs, habit streak identical after Finish planning → Undo); all test rows deleted. 27 + 26 unit cases cover the time/overlap/slot and event logic.
- **Not built yet:** the assistant agent still needs the `events` and `time_blocks` schema; blocks for habits (the FK allows it, the plan page only lists Missions/Chores); the Goal wizard has no event/block step.

### Events (things that happen at a set time) vs. Tasks (things due by a date)
Gus's work has both: a guitar recording at 2–6pm on a given day can't be done early (an **event**); "tune the guitars" has to be done by a date (a **task**). Tasks can prepare for an event, and events can belong to a Goal (via a Milestone) or stand alone. Built with Gus's explicit approval; his two decisions: **events award XP when marked "happened"** and **don't count toward the Good Day**, and **no recurring events in v1** (each is created once).
- **Schema** (`supabase/migrations/20261106000002_events.sql`, applied by Gus in the Supabase SQL Editor): `events` table (`player_id`, `area_id`, nullable `milestone_id`, `title`, `event_date`, `start_time`, `end_time`, `location`, `status` = scheduled/happened/missed/cancelled, `resolved_on`, plus the same XP/area-capacity snapshot columns `task_logs` has so undoing is exact) and `tasks.event_id` (nullable FK, `on delete set null`). **Date and time are plain local values with no timezone** (single player, Bogota) — the same convention as every other date here. `end_time` earlier than `start_time` means it runs past midnight.
- **XP:** marking an event "happened" (`setEventStatus` in `src/app/events/actions.ts`) awards a Main Task's worth (4×) as Growth XP, capped by that Area's remaining daily ceiling — `xp-service.ts`'s `areaGrowthXpAwardedOn` now counts task logs **and** events resolved that day against the ceiling, shared by `computeXpForCompletion` and `computeXpForEvent`. It also resets the Area's decay clock and can fire the re-engagement bonus and a Nivel-up, like a task. **No Task Activation Delay** (an event can't be done early anyway). Undo/"Reopen"/deleting a happened event restores XP and the Area exactly (verified against a real before/after snapshot). Missed/cancelled award nothing and carry no penalty.
- **"Happened" only once it has started** (`hasStarted`, enforced in the server action with Bogota time via `getNowTimeString`). Past events nobody marked show "Did it happen?" the next day — asked gently, never penalized.
- **Today:** an **Agenda** section above Habit Streaks (`AgendaSection.tsx`): **only today's events**, unresolved past ones, and ones finished today. (It first used the tasks' 3-day window, but an event 3 days away under "Today" with an "In 3 days" badge read like a deadline — fixed; upcoming events live in `/agenda`. Prep tasks still show "for: <event>" whatever the event's date.) Each lists its still-open prep tasks, and those tasks show "for: <event>" under their title. Event XP also counts in the "XP today" counter and the Growth Rings.
- **Manage:** events nest under their Milestone (`MilestoneRow`, "+ Add event", "Tasks & events (n)"; editing under a Milestone can't move it to another). A standalone **Events** section lists the rest, with a collapsed "Past events". Task forms (`TaskForm`, `MilestoneTaskForm`, `TaskRow` edit) have a "Prepares for…" picker (`EventLinkSelect`); picking an event suggests the task's deadline as the day before it (never earlier than today). `EventsContext` shares the event list with those components instead of threading props. Deleting a Goal also deletes its events.
- **Not built yet:** the Goal wizard has no event step; the assistant agent needs the schema (it can create events and set `tasks.event_id`); recurring events; Google Calendar sync (discussed, deliberately out of scope).

### Task deadlines (`due_date`) — one-off tasks are done for good, Today shows only what's due soon
Gus loaded ~26 Missions/Chores through his personal assistant agent and Today became an endless list. Rather than a manual priority flag first, the fix starts from deadlines (his call: forcing a date at creation forces him to plan, instead of "someday"). **Every Main Task and Chore now carries a deadline; Habits never do** (they recur).
- **Schema** (`supabase/migrations/20261106000001_task_due_date.sql`, applied by Gus in the Supabase SQL Editor — the app only has the anon key, which can't run DDL): `tasks.due_date` and `tasks.done_date`, both nullable. **A "deadline required" DB constraint is deliberately NOT added yet** — the 26 legacy tasks are undated and, with a constraint, even marking one done (an UPDATE) would be rejected. Add it as a later migration once they're all dated (check with `tier <> 'habit' and due_date is null`, count should be 0).
- **Done for good:** completing a task with a `due_date` sets `done_date` (in `toggleTaskCompletion`); undoing it the same day clears it (guarded on the date). A done task is hidden from Today from the next day on. **Before this, nothing ever deactivated a task on completion — a completed Mission came back unchecked the next day**, which is a big part of why the list never shrank. Undated legacy tasks still behave the old way until they get a date.
- **What Today shows** (`src/lib/deadline.ts`, `todayPlacement`): habits always; undated legacy tasks; dated tasks due within `DEADLINE_WINDOW_DAYS` (3) or overdue; anything finished today (so its checkbox still reads done). Dated tasks further out go to a collapsed **Backlog (N)** list (`BacklogList.tsx`), sorted by date. Dated tasks show a quiet label that escalates — "Due in 3 days" → "Due tomorrow"/"Due today" → "Overdue by N days" — never a popup/modal, and nothing is penalized for being overdue (reschedule instead). Today also shows a "N tasks need a deadline" link to Manage's **Needs a deadline** panel (`DeadlinePanel.tsx`, `setTaskDueDate`), which lists every undated non-habit task including inactive/planned ones.
- **Forms:** `DeadlineInput` is a required date field (past dates blocked via `min` for new tasks; editing may keep an overdue date) in `TaskForm`, `MilestoneTaskForm`, the Goal wizard's task step and `TaskRow`'s edit form. For non-habit tiers the recurrence select is hidden and stored as `daily` (a dated task is done once, so recurrence means nothing). `createTask` also enforces it server-side.
- **Good Day alignment (explicitly approved by Gus):** `good-day-service.ts` now counts a *dated* task as due on a past day only under the same rule Today uses (`isDueOnDay`: it already existed that day, its 3-day window was open or it was overdue, and it wasn't finished on an earlier day), ignoring `recurrence`. Otherwise tasks hidden in the Backlog would count against Good Days nobody could see them on. Undated tasks keep the old rule (`recurrence === 'daily'` only). This modifies how "due" is defined in CLAUDE.md formula #2 for dated tasks only.
- **Still to do:** the manual "Foco" priority idea (per-task star, cap of 3 Missions + 2 Chores) was set aside until deadlines are in — revisit once Today is driven by dates and see whether it's still needed. Push/phone notifications are a separate, later project (would need a PWA + a push service; Vercel Hobby cron is once/day).

### Habit Stats month browser, "History by month", and CSV export
Gus wanted access to past months' habit data (and how many times he took his pills). No new database was needed — everything already lives in `task_logs` / `daily_good_days` — so this is read-side only, plus a backup path out of Supabase:
- **Per-habit month browser:** the Habit Stats detail view has ← / → arrows to step through months (prev disabled at the habit's first month, next disabled at the current one); the stat card and calendar follow the selected month. **"History by month"** on the list view shows one card per month, newest first, with every Habit's `X/Y · %` — same fixed-month-size denominator as everywhere else (`statsForMonth` in `habit-stats.ts` delegates to `monthlyCompletionStats`, so numbers can never disagree between views). Month keys ("YYYY-MM") are manipulated arithmetically (`shiftMonthKey`), never through `getDateString`.
- **A Habit's start date is `min(activated_at, first completion)`** (`habit-stats/page.tsx`): a completion logged before a habit's recorded activation (e.g. after the day-boundary data correction nudged one back a day — Instrument Practice's Aug 9 log) must still show up, not be dropped as "before the habit existed".
- **Full backup (`/api/export?dataset=full`, linked as "Full backup (JSON)" on Habit Stats):** one JSON file with **every table** (`FULL_BACKUP_TABLES` in `src/app/api/export/route.ts`) plus `row_counts` for a quick sanity check — enough to rebuild the game, unlike the two CSVs (completions / good days only). Supabase's free plan has no automatic backups, so this is the real safety net; Gus saves it to his T7 disk with the weekly backup reminder. **When a migration creates a new table, add it to `FULL_BACKUP_TABLES`** or it silently stays out of the backup. Verified against the real DB (row counts match a direct count per table). It contains all his personal data and the route has no auth, like the rest of the app — don't link or publish its URL anywhere.
- **CSV export:** `src/app/api/export/route.ts` — `GET /api/export?dataset=completions` (every task completion) or `dataset=good-days` (per-day Good Day breakdown), linked from Habit Stats. UTF-8 BOM, CRLF, RFC 4180 quoting, and a formula-injection guard (text starting `= + - @` gets a `'` prefix). Purpose is an off-Supabase copy of the history (free-tier projects can be paused/deleted — see below). **No auth**, like the rest of the app; it exposes nothing Habit Stats doesn't already show.
- **PostgREST silently caps responses at 1000 rows.** `src/lib/fetch-all.ts`'s `fetchAllRows` pages through with `.range()` (stable `order` incl. `id` as tiebreaker) — use it for any query that can grow unbounded. The old lifetime-count query had this latent cap; it was replaced by `getAllCompletedDatesByTask` (all dates per task, paginated). Also: many-to-one embeds (`tasks(..., areas(...))`) come back as objects at runtime but supabase-js (no generated types) infers arrays, so the export casts to the real shape.

### Supabase free-tier auto-pause outage + daily keep-alive cron
After ~2 weeks without opening the app, the whole thing went down: the live page showed "No player found." (the app itself was healthy, but every database call failed) and `nonuyvyqrndgxwtirwhx.supabase.co` returned NXDOMAIN on every public resolver. Cause: Supabase's free plan **auto-pauses a project after ~7 days with no activity** — not a code bug, and nothing in the repo can fix a paused project by itself; it had to be restored by hand from the Supabase dashboard ("Restore project"; data is kept while paused, but a project paused long enough can eventually be deleted). **If the app ever shows "No player found." or the Supabase host stops resolving, check the Supabase dashboard first, before suspecting code.**
- Prevention: `src/app/api/keep-alive/route.ts` does the cheapest possible read (`areas`, limit 1) and returns only `{ ok }` (500 on a database error, so a failure is visible in Vercel's cron logs). `vercel.json` schedules it daily at 12:00 UTC via Vercel Cron (the Hobby plan allows one run per day, at imprecise times within the scheduled hour). Any real query counts as activity for Supabase's pause policy, but this is a best-effort guard — not a guarantee against pausing.

### Voyage Map — macro Capítulo map + shared WindingPath component (design doc Section 18)
- `src/app/voyage/page.tsx` (new route, linked from Today via a "Voyage →" label next to the Chapter/Milestone name) renders all 15 Capítulos as nodes in a bottom-to-top winding path — `current_level` determines completed/current/locked per node. **This is a browsable status page, not an active celebration** — nothing navigates here or notifies the player when a Chapter actually advances; `current_level` just increments silently as before, and this map reflects that state whenever it's next opened. No Chapter-up toast/banner of any kind has ever actually been built (see MVP scope note above). Every Capítulo shows its real Milestone name now, not just Chapters 1-3: `src/lib/milestones.ts`'s `MILESTONE_NAMES` was extended to cover all 15 using the already-locked 5-Milestone table from design doc Section 7.1 (Stability/Momentum/Growth/Balance/Healthy Life) — wiring up names that were already locked but unused past Chapter 3, not inventing new content.
- The drawing logic (winding SVG path, node states, labels) was extracted into `src/components/WindingPath.tsx`, shared with the Goal Milestone path (`GoalPathView.tsx`, below) — same visual language at two scales per design doc Section 18.2, not two parallel implementations. Takes an optional `scale` (size multiplier, default 1 — leaves `GoalPathView`'s look unchanged) and `nodeShape` (`"circle"` default, `"hexagon"` for the Voyage Map specifically, matching its cartography/Explorer-archetype framing, Section 18.1). Circles remain the shape everywhere else in the app (Habit Streak rings, Growth Rings, Goal Milestone path) — hexagons are a deliberate one-off for the macro map only.
- **Real hydration bug found and fixed while adding the hexagon shape:** `Math.cos`/`Math.sin` aren't guaranteed bit-identical between Node's SSR render and the browser's own V8, so unrounded hexagon-vertex coordinates baked into the server HTML occasionally differed from the client's own computation by a trailing digit, tripping a React hydration mismatch. Fixed by rounding hexagon vertices to 2 decimals (`WindingPath.tsx`'s `hexagonPoints`) — far more precision than the shape needs visually, and removes any cross-engine float drift. **Any future SVG coordinates computed with trig functions and rendered by a Server Component need the same rounding**, not just this one shape.

### Goal Milestone mini-path (Voyage Map at Goal scale, design doc Section 18.2)
- Replaced the flat Milestone progress bar on Goal cards in `/manage` with the same node/route visual language as the Voyage Map, at Goal scale: `src/components/manage/GoalMilestonePath.tsx` (compact, horizontal, inline on the card) and `src/components/manage/GoalPathView.tsx` (full-screen, vertical, bottom-to-top winding path, opened via a "View path" link — now reuses `WindingPath.tsx`, see above).
- **Real containing-block bug found and fixed:** this overlay's (and the Goal wizard's, below) full-screen `fixed inset-0` wasn't actually fixed to the viewport — `template.tsx`'s page-transition wrapper applies a CSS `transform`, which per spec makes it the containing block for any `position:fixed` descendant, so the overlay was sizing/positioning itself against the whole scrollable page instead of the real viewport. Fixed by portaling both overlays straight to `document.body` via `createPortal`. **Any future full-screen takeover in this app needs the same portal treatment** — the plain `fixed inset-0` recipe documented further down (Goal wizard entry) is incomplete on its own now that `template.tsx` exists.

### Production outage, several times: a real infinite loop in the Good Day backfill (not either of the two things first suspected)
The app crashed intermittently in production (HTTP 500, eventually a full Node process crash with "JavaScript heap out of memory") after sitting unopened for a day or more. Two plausible-looking fixes were tried first and both were wrong — worth remembering so the same wrong turns aren't retaken:
1. First suspected `Intl.DateTimeFormat` with a named timezone (see "Day-boundary bug" below) crashing Vercel's Node runtime at module init — removed it in favor of fixed-offset math. The crash recurred identically.
2. Then suspected Turbopack's production build output itself, since the crash logs showed 0 outgoing requests and ~30ms execution (dying before any app code that could touch a timezone API even ran) — switched `package.json`'s `build` script to `next build --webpack`. **This change is still in place and should stay** (no proven advantage to Turbopack's production build here, and this incident is reason enough not to switch back without a real need) — but it didn't fix the crash either.
3. **The real cause**, found only once Vercel's function logs were read in full rather than just the truncated first stack frame: `good-day-service.ts`'s `addDays()` parsed its input as server-local midnight, shifted it with local `setDate`/`getDate`, then formatted the result through `today.ts`'s `getDateString()` — which reads the instant back in America/Bogota, a different zone than the server's (UTC on Vercel). A UTC-midnight instant read 5 hours earlier lands on the *previous* calendar day, so `addDays(date, 1)` silently returned the same date it was given instead of advancing. `dateRange()`'s `for` loop uses `addDays(current, 1)` as its own increment step, so once the Good Day backfill had more than a few hours' worth of unfinalized days to catch up on, `current` never advanced and the loop pushed the same string into its result array forever, exhausting server memory. Fixed by giving `addDays()` its own pure calendar-day arithmetic (`Date.UTC`/`getUTCDate`/`setUTCDate`) with no round-trip through any real-world-timezone conversion — adding N days to a date string has nothing to do with what time it is anywhere. Also capped `dateRange()` at ~10 years of days so a *future* date-arithmetic bug throws a normal, immediately-visible exception instead of silently exhausting memory again.

**Lesson for any future date-handling code in this app:** never construct a `Date` from a bare date-only string or from local-timezone `Date` methods and then pass it through `getDateString()` — that function explicitly reads in America/Bogota, so anything built via server-local semantics upstream of it silently lands on the wrong day. Only feed it real-world instants (`new Date()`, or a genuine `timestamptz` from the database) — never a re-parsed "YYYY-MM-DD" string or a `Date` built from numeric year/month/day parts.

### Day-boundary bug: the server computed "today" in UTC, not Bogota
`src/lib/today.ts`'s `getDateString`/`getTodayDateString` used to read `Date`'s own local getters — correct on a machine running in the player's own timezone, wrong on Vercel's serverless functions, which run in UTC. For roughly 5 evening hours a day (Bogota is UTC-5), the server had already rolled its clock into "tomorrow" while it was still today for Gus — a Habit marked at night could get logged against the wrong date, later appearing pre-completed or blocking a fresh mark. Fixed with fixed-offset arithmetic — Bogota has no DST, so a constant -5h shift is exact and needs no timezone database/ICU dependency (an initial fix using `Intl.DateTimeFormat` with a named zone worked locally but crashed Vercel's production Node runtime outright — see the outage entry above). **A same-class regression this fix caused, also fixed:** `habit-stats.ts`'s monthly calendar built each day's date string via `getDateString(new Date(year, month, day))` — a `Date` built from numeric parts is interpreted in the server's own local timezone (UTC), so formatting it through the now-Bogota-aware `getDateString` shifted the whole calendar back by one day (today read as already logged, tomorrow read as available). Fixed by building those date strings directly from the known year/month/day numbers, no `Date` object round-trip at all.

### Avatar system + Avatar Growth Rings (design doc Sections 12, 20)
- Base identity only (gender, skin tone, hair style/color, eye color — free, chosen once, editable anytime) — no MP-earnable clothing yet, see "New design additions" above for why. `src/lib/avatar.ts` (taxonomy + swatches), `src/components/Avatar.tsx` (flat-vector SVG bust, same code-built approach as `AreaIcon.tsx`).
- `src/components/AvatarWidget.tsx` — a small badge in Today's header (persistent-but-secondary per Section 12.1) expands into the 5 Growth Rings arranged around the Avatar. Each ring's fill = today's XP earned in that Area ÷ that Area's daily ceiling (already-locked formula, Section 20.2), resetting naturally every day since it's derived from today's logs rather than stored state — deliberately distinct from the per-Habit Streak ring elsewhere on Today (Growth Rings show no number, always exactly 5 at once, and only ever appear in this expanded view — never side-by-side with Habit Streak rings). Reaching 100% in an Area fires a one-time full-screen celebration (no new XP/MP — Section 20.4), detected client-side by comparing consecutive fill values across page revalidations.
- `updateAvatar` server action in `src/app/actions.ts`; avatar fields live directly on `players` (single-player app, same convention as `current_level`/`cumulative_xp`) — see `supabase/migrations/20260813000001_avatar.sql`.

### Today ↔ Manage page transition + Goal wizard full-screen takeover
- `src/app/template.tsx` — Next.js `template.tsx` remounts on every navigation (unlike `layout.tsx`), used to apply a ~300ms fade + slight rise transition between Today and Manage instead of an instant page swap. This is the app's standard "how things appear" pattern now — reuse it (mount → `requestAnimationFrame` flips an `entered` state a frame later → CSS transition reacts to it) rather than inventing a new transition style.
- The Goal wizard (below) uses the same pattern for its own enter transition, and is a `fixed inset-0` full-screen overlay with `document.body.style.overflow = "hidden"` while open (restored on close) — this is the established pattern for any future full-screen takeover in this app, not a one-off.

### Performance: cut sequential Supabase round trips on page loads
Today→Manage navigation was measured at ~1.1s in production. Found and fixed 3 concrete sources of unnecessarily *sequential* (not parallel) Supabase queries:
- `src/lib/good-day-service.ts` — `backfillGoodDays` now fetches `playerRow` and `lastFinalized` together (`Promise.all`; they don't depend on each other). `windowGoodDayCount` still has to wait for that result, since it genuinely needs `player.current_level`.
- `src/lib/capacity-service.ts` — `refreshAllAreaCapacities` now reads all of a player's `area_capacities` rows in **one** query instead of first fetching the `areas` table for ids and then re-fetching each area's capacity row individually. The old per-area `refreshAreaCapacity` helper was removed (it had no other callers).
- `src/app/manage/page.tsx` — `activateScheduledTasks` now runs inside the same `Promise.all` as the page's other 5 queries instead of sequentially before them.
- **Finding, worth remembering so it isn't re-investigated from scratch:** after these fixes, live production navigation timing was still noisy across repeated measurements (roughly 600ms–3000ms). This looks like Vercel Hobby-tier serverless cold starts, not remaining query count — a real fix here would mean a hosting-tier/warm-instance conversation, not more query parallelization. Don't assume more of this same optimization will move the needle further without new evidence.

### Goal creation wizard + Goal deletion
Creating a Goal is no longer a flat one-shot form — `GoalForm.tsx` was deleted in favor of a guided 3-step flow:
- `src/components/manage/GoalWizard.tsx` — Step 1 (title + primary/secondary Area), Step 2 (add Milestones), Step 3 (walks through each Milestone **one at a time** — "Milestone 1 of 2", etc. — prompting for ~2-3 Tasks per Milestone via a Habit/Main Task tier toggle; every Task added auto-links to whichever Milestone is currently showing, there's no milestone-picker dropdown). Each step persists immediately through the existing `createGoal` / `createMilestone` / `createTask` server actions (`src/app/manage/actions.ts`, extended to return the inserted row's `id` so the wizard can chain steps) — there's no "submit everything at the end" moment, so closing partway through is safe; whatever was added already shows up normally in the Goals list.
- Renders as the full-screen takeover described above, not an inline panel.
- **Goal deletion:** an "Edit" toggle next to the Goals heading (`src/components/manage/GoalsSection.tsx` — new, extracted from `manage/page.tsx` to hold this shared toggle state across all Goal cards) swaps each Goal card's Complete/Abandon actions for a Delete button, same confirm/cancel pattern already used for Task rows. `deleteGoal` (in `manage/actions.ts`) cascades explicitly — Tasks, then Milestones, then the Goal itself, in that order — rather than relying on unverified DB cascade rules, since a Main Task can never validly exist with a null `milestone_id`.

### Area icons reused as small UI icons in Manage (gamification pass, step 1)
`src/components/AreaIcon.tsx` — flat SVG icons per Area, reusing the Area → Ship-part mapping already locked in the design doc (Section 10.2: Physical=hull, Mental=helm, Career=sails, Relationships=crew quarters, Exploration=crow's nest/spyglass). Used as small icon chips on Goal cards and Task rows in Manage, plus a milestone-progress bar on Goal cards and a checklist-style marker on Milestone rows. **This is presentation only — not the Ship system itself**, which is still not built (placeholder toast on Nivel-up still stands, see MVP scope above). It does confirm the flat-vector-icon approach works well in practice; reuse this icon set rather than building a second one whenever the real Ship gets built.

**Recurring mobile layout bug, fixed in 3 places — watch for this pattern in any new UI row:** `flex items-center justify-between` rows with no `flex-wrap`, holding both a title/long text and a cluster of right-aligned action buttons/text, break on narrow (~375px) viewports — either the actions overflow off-screen, or the title gets crushed into single-word-per-line wrapping. Fixed in `TaskRow.tsx`, the Goal-card header in `GoalsSection.tsx`, and `MilestoneRow.tsx`, all with the same recipe: `flex flex-wrap ... gap-x-* gap-y-*` on the row, plus `min-w-[Npx] flex-1` on the primary (left) content block so it wins the first line instead of shrinking indefinitely. Apply this proactively to any new row mixing long text with multiple action buttons — don't wait for it to be reported again.

### Optimistic UI for Task completion
`src/lib/use-task-completion.ts` uses React 19's `useOptimistic` so a Task's checkbox/ring flips the instant it's clicked, instead of waiting for the server round trip + page revalidation. XP amounts, streak milestones, and Nivel-ups stay server-authoritative and only appear once the server responds — deliberately never predicted client-side, since that would mean forking the ceiling/bonus/milestone math into two places that could drift. **Also fixed a real double-submission race found while testing:** `isPending` from `useTransition` doesn't disable the input until after a render commits, so two clicks landing back-to-back could both fire and double-award XP before either saw the disabled state. A synchronous `useRef` guard (set before any `await`, checked at the top of the handler) closes that window; `isPending`/`disabled` alone was not sufficient.

### Habit Stats monthly denominator (bug fix; formula wasn't previously written down here)
`src/lib/habit-stats.ts`'s "X/Y this month" (shown on Today's Habit Streak cards and the Habit Stats page) uses `Y` = the **fixed size of the current month's window** — days in the month (30/31/28/29), or from activation to month-end if the Habit started mid-month — **not** days elapsed so far. It originally counted elapsed days, which read backwards (e.g. "0/3" on day 3 looked like a near-perfect score instead of a mostly-empty month); fixed so it counts up toward the whole month. The `rate` percentage shown alongside it uses the same fixed denominator, so the fraction and the % never contradict each other.

### Visual theme: "Vivid Light" / mint (not previously documented here)
The app's visual theme is light-only — mint `--background`, distinct `--surface`/`--surface-hover` tokens for cards so they read as genuinely different surfaces rather than a blurred/gray version of the page background. The `prefers-color-scheme: dark` block in `globals.css` is deliberately kept in sync with the light `:root` values — **this is not a real dark theme**, that was an explicit decision (not an oversight born from never building one). Don't "fix" it into an actual dark mode without asking first.

---

Ask before adding anything not listed above. When in doubt about a formula or a rule not covered here, check `docs/game_design.md` before guessing.
