"use client";

import { useEffect, useState, useTransition } from "react";
import { createGoal, createMilestone, createTask } from "@/app/manage/actions";
import { areaColor } from "@/lib/area-colors";
import { AreaIcon } from "@/components/AreaIcon";

type Area = { id: string; name: string };
type Step = "goal" | "milestones" | "tasks";

const STEPS: Step[] = ["goal", "milestones", "tasks"];

// Progress dots reuse the same accent-fill-on-track language as the Good
// Days / Nivel bars (LevelProgress.tsx) and the Goal card's milestone bar
// -- one visual vocabulary for "progress" across the whole app.
function StepDots({ step }: { step: Step }) {
  const current = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className="h-1.5 flex-1 rounded-full"
          style={{
            backgroundColor: "var(--accent-primary)",
            opacity: i <= current ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

// Guided Goal creation: Goal -> Milestones -> starting Tasks, calling the
// same server actions the rest of /manage already uses, just sequenced
// step by step instead of scattered across separate inline forms. Each
// step persists as you go (there's no final "submit everything" moment),
// so closing partway through is safe -- whatever was added already shows
// up normally in the Goals list below.
export function GoalWizard({ playerId, areas }: { playerId: string; areas: Area[] }) {
  const [open, setOpen] = useState(false);
  // Drives the enter transition: mounts in its "before" state, then flips
  // a frame later so the browser actually animates the change instead of
  // painting the "after" state immediately.
  const [entered, setEntered] = useState(false);
  const [step, setStep] = useState<Step>("goal");
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [secondaryAreaIds, setSecondaryAreaIds] = useState<string[]>([]);

  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");

  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestones, setMilestones] = useState<{ id: string; title: string }[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskTier, setTaskTier] = useState("habit");
  const [taskAreaId, setTaskAreaId] = useState("");
  const [taskRecurrence, setTaskRecurrence] = useState("daily");
  const [taskActivateNow, setTaskActivateNow] = useState(false);
  // Which Milestone (by index) Step 3 is currently guiding the player to
  // add Tasks for -- the step walks through them one at a time instead of
  // asking the player to pick a Milestone from a dropdown per Task.
  const [taskMilestoneIndex, setTaskMilestoneIndex] = useState(0);
  const [tasksByMilestone, setTasksByMilestone] = useState<
    Record<string, { id: string; title: string }[]>
  >({});

  const goalColor = areaColor(areas.find((a) => a.id === areaId)?.name);

  // Full-screen takeover while open -- lock the page behind it so it can't
  // scroll through underneath (mostly a mobile Safari rubber-banding
  // concern, but harmless everywhere else).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(open));
    return () => cancelAnimationFrame(id);
  }, [open]);

  function reset() {
    setStep("goal");
    setTitle("");
    setAreaId(areas[0]?.id ?? "");
    setSecondaryAreaIds([]);
    setGoalId(null);
    setGoalTitle("");
    setMilestoneTitle("");
    setMilestones([]);
    setTaskTitle("");
    setTaskTier("habit");
    setTaskAreaId("");
    setTaskRecurrence("daily");
    setTaskActivateNow(false);
    setTaskMilestoneIndex(0);
    setTasksByMilestone({});
  }

  function handleCreateGoal() {
    if (!title.trim() || !areaId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("playerId", playerId);
      fd.set("title", title.trim());
      fd.set("areaId", areaId);
      secondaryAreaIds.forEach((id) => fd.append("secondaryAreaIds", id));
      const result = await createGoal(fd);
      if (result) {
        setGoalId(result.id);
        setGoalTitle(title.trim());
        setTaskAreaId(areaId);
        setStep("milestones");
      }
    });
  }

  function handleAddMilestone() {
    if (!milestoneTitle.trim() || !goalId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("goalId", goalId);
      fd.set("title", milestoneTitle.trim());
      const result = await createMilestone(fd);
      if (result) {
        setMilestones((prev) => [...prev, { id: result.id, title: milestoneTitle.trim() }]);
        setMilestoneTitle("");
      }
    });
  }

  function handleAddTask() {
    const currentMilestone = milestones[taskMilestoneIndex];
    if (!taskTitle.trim() || !taskAreaId || !currentMilestone) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("playerId", playerId);
      fd.set("title", taskTitle.trim());
      fd.set("tier", taskTier);
      fd.set("areaId", taskAreaId);
      fd.set("recurrence", taskRecurrence);
      fd.set("milestoneId", currentMilestone.id);
      fd.set("isActive", taskActivateNow ? "true" : "false");
      const result = await createTask(fd);
      if (result) {
        setTasksByMilestone((prev) => ({
          ...prev,
          [currentMilestone.id]: [
            ...(prev[currentMilestone.id] ?? []),
            { id: result.id, title: taskTitle.trim() },
          ],
        }));
        setTaskTitle("");
        setTaskActivateNow(false);
      }
    });
  }

  function handleFinish() {
    reset();
    setOpen(false);
  }

  function goToTasksStep() {
    setTaskMilestoneIndex(0);
    setStep("tasks");
  }

  // Advances the "which Milestone are we adding Tasks for" pointer --
  // whether the player added Tasks for this one or skipped it. On the
  // last Milestone, this closes the wizard instead.
  function goToNextMilestone() {
    if (taskMilestoneIndex < milestones.length - 1) {
      setTaskMilestoneIndex((i) => i + 1);
      setTaskTitle("");
      setTaskTier("habit");
      setTaskActivateNow(false);
    } else {
      handleFinish();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary self-start rounded-lg px-4 py-2 text-sm"
      >
        + New Goal
      </button>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-4 p-6 transition-transform duration-300 ease-out ${
          entered ? "translate-y-0" : "translate-y-4"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground/45">
            New Goal · Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </span>
          <button type="button" onClick={handleFinish} className="link-hover text-xs text-foreground/50">
            {goalId ? "Done" : "Cancel"}
          </button>
        </div>
        <StepDots step={step} />

      {step === "goal" && (
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title"
            className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          />
          <label className="text-xs text-foreground/60">
            Primary area
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm text-foreground"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-foreground/60">Secondary areas (optional)</legend>
            {areas
              .filter((a) => a.id !== areaId)
              .map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={secondaryAreaIds.includes(area.id)}
                    onChange={(e) =>
                      setSecondaryAreaIds((prev) =>
                        e.target.checked ? [...prev, area.id] : prev.filter((id) => id !== area.id),
                      )
                    }
                    style={{ accentColor: areaColor(area.name).accent }}
                  />
                  {area.name}
                </label>
              ))}
          </fieldset>
          <button
            type="button"
            onClick={handleCreateGoal}
            disabled={isPending || !title.trim()}
            className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
          >
            Next
          </button>
        </div>
      )}

      {step === "milestones" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: goalColor.soft, color: goalColor.accent }}
            >
              <AreaIcon areaName={areas.find((a) => a.id === areaId)?.name} className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{goalTitle}</span>
          </div>

          {milestones.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm text-foreground/80">
                  <span
                    aria-hidden
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: "var(--accent-primary)", color: "var(--on-accent-primary)" }}
                  >
                    ✓
                  </span>
                  {m.title}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddMilestone();
                }
              }}
              placeholder="Milestone title…"
              className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleAddMilestone}
              disabled={isPending || !milestoneTitle.trim()}
              className="btn-primary rounded px-3 py-1 text-sm disabled:opacity-60"
            >
              Add
            </button>
          </div>

          <p className="text-xs text-foreground/40">2-5 works well, but you can always add more later.</p>

          <button
            type="button"
            onClick={goToTasksStep}
            className="link-hover self-start text-sm font-medium text-foreground/70"
          >
            {milestones.length > 0 ? "Continue →" : "Skip for now →"}
          </button>
        </div>
      )}

      {step === "tasks" &&
        (milestones.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground/60">
              No Milestones yet, so there&apos;s nothing to attach Tasks to — you can always add
              both from the Goal card below.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              className="btn-primary self-start rounded px-3 py-1 text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          (() => {
            const currentMilestone = milestones[taskMilestoneIndex];
            const currentTasks = tasksByMilestone[currentMilestone.id] ?? [];
            const isLast = taskMilestoneIndex === milestones.length - 1;

            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: goalColor.soft, color: goalColor.accent }}
                  >
                    <AreaIcon areaName={areas.find((a) => a.id === areaId)?.name} className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{goalTitle}</span>
                </div>

                {/* Guides the player through one Milestone at a time instead
                    of a generic "which Milestone does this belong to"
                    picker -- every Task added below is automatically
                    attached to this one. */}
                <div
                  className="flex items-center gap-3 rounded-lg p-3"
                  style={{ backgroundColor: goalColor.soft }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: goalColor.accent, color: "var(--on-accent-primary)" }}
                  >
                    {taskMilestoneIndex + 1}
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide" style={{ color: goalColor.accent }}>
                      Milestone {taskMilestoneIndex + 1} of {milestones.length}
                    </p>
                    <p className="text-sm font-medium">{currentMilestone.title}</p>
                  </div>
                </div>

                {currentTasks.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {currentTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm text-foreground/80">
                        <span
                          aria-hidden
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                          style={{ backgroundColor: "var(--accent-primary)", color: "var(--on-accent-primary)" }}
                        >
                          ✓
                        </span>
                        {t.title}
                      </li>
                    ))}
                  </ul>
                )}

                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder={`A task for "${currentMilestone.title}"…`}
                  className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
                />

                <div className="flex gap-1.5">
                  {(["habit", "main_task"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTaskTier(t)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                        taskTier === t ? "" : "border-foreground/20 text-foreground/60"
                      }`}
                      style={
                        taskTier === t
                          ? { backgroundColor: goalColor.soft, borderColor: goalColor.accent, color: goalColor.accent }
                          : undefined
                      }
                    >
                      {t === "habit" ? "Habit" : "Main Task"}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select
                    value={taskAreaId}
                    onChange={(e) => setTaskAreaId(e.target.value)}
                    className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={taskRecurrence}
                    onChange={(e) => setTaskRecurrence(e.target.value)}
                    className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                  <input
                    type="checkbox"
                    checked={taskActivateNow}
                    onChange={(e) => setTaskActivateNow(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Activate now (otherwise planned for later)
                </label>

                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={isPending || !taskTitle.trim()}
                  className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
                >
                  Add task
                </button>

                <p className="text-xs text-foreground/40">
                  Try 2-3 tasks to get this milestone moving — or skip it for now.
                </p>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep("milestones")}
                    className="link-hover text-xs text-foreground/50"
                  >
                    ← Back to Milestones
                  </button>
                  <button
                    type="button"
                    onClick={goToNextMilestone}
                    className="link-hover text-sm font-medium text-foreground/70"
                  >
                    {currentTasks.length > 0
                      ? isLast
                        ? "Done →"
                        : "Next milestone →"
                      : isLast
                        ? "Skip & finish →"
                        : "Skip this milestone →"}
                  </button>
                </div>
              </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}
