"use client";

import { useState, useTransition } from "react";
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
  const [taskMilestoneId, setTaskMilestoneId] = useState("");
  const [taskRecurrence, setTaskRecurrence] = useState("daily");
  const [taskActivateNow, setTaskActivateNow] = useState(false);
  const [addedTasksCount, setAddedTasksCount] = useState(0);

  const goalColor = areaColor(areas.find((a) => a.id === areaId)?.name);

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
    setTaskMilestoneId("");
    setTaskRecurrence("daily");
    setTaskActivateNow(false);
    setAddedTasksCount(0);
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
    if (!taskTitle.trim() || !taskAreaId) return;
    if (taskTier === "main_task" && !taskMilestoneId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("playerId", playerId);
      fd.set("title", taskTitle.trim());
      fd.set("tier", taskTier);
      fd.set("areaId", taskAreaId);
      fd.set("recurrence", taskRecurrence);
      if (taskMilestoneId) fd.set("milestoneId", taskMilestoneId);
      fd.set("isActive", taskActivateNow ? "true" : "false");
      const result = await createTask(fd);
      if (result) {
        setAddedTasksCount((n) => n + 1);
        setTaskTitle("");
        setTaskMilestoneId("");
        setTaskActivateNow(false);
      }
    });
  }

  function handleFinish() {
    reset();
    setOpen(false);
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
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/20 bg-surface p-4">
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
            onClick={() => setStep("tasks")}
            className="link-hover self-start text-sm font-medium text-foreground/70"
          >
            {milestones.length > 0 ? "Continue →" : "Skip for now →"}
          </button>
        </div>
      )}

      {step === "tasks" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: goalColor.soft, color: goalColor.accent }}
            >
              <AreaIcon areaName={areas.find((a) => a.id === areaId)?.name} className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{goalTitle}</span>
            {addedTasksCount > 0 && (
              <span className="text-xs text-foreground/40">
                · {addedTasksCount} task{addedTasksCount === 1 ? "" : "s"} added
              </span>
            )}
          </div>

          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task title (optional — you can skip this step)"
            className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
          />

          <div className="flex gap-2">
            <select
              value={taskTier}
              onChange={(e) => setTaskTier(e.target.value)}
              className="flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
            >
              <option value="habit">Habit</option>
              <option value="main_task">Main Task</option>
            </select>
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

          {milestones.length > 0 ? (
            <select
              value={taskMilestoneId}
              onChange={(e) => setTaskMilestoneId(e.target.value)}
              className="rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm"
            >
              <option value="">
                {taskTier === "main_task" ? "Link to a Milestone…" : "No linked Milestone (standalone habit)"}
              </option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          ) : (
            taskTier === "main_task" && (
              <p className="text-xs text-foreground/40">
                Main Tasks need a Milestone — go back and add one, or switch this to a Habit.
              </p>
            )
          )}

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
            disabled={isPending || !taskTitle.trim() || (taskTier === "main_task" && !taskMilestoneId)}
            className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
          >
            Add task
          </button>

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
              onClick={handleFinish}
              className="link-hover text-sm font-medium text-foreground/70"
            >
              Done →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
