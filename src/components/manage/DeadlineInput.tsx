"use client";

import { getTodayDateString } from "@/lib/today";

// The deadline every Main Task and Chore needs. `name` makes it a plain form
// field; pass `value`/`onChange` instead when the parent holds the state
// (the Goal wizard). Past dates are blocked for new tasks via `min`; when
// editing an overdue task the existing date is allowed to stay.
export function DeadlineInput({
  name = "dueDate",
  value,
  onChange,
  defaultValue,
  allowPast = false,
  small = false,
}: {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  allowPast?: boolean;
  small?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-foreground/60 ${small ? "text-xs" : "text-sm"}`}
    >
      <span className="shrink-0">Due by</span>
      <input
        type="date"
        name={name}
        required
        min={allowPast ? undefined : getTodayDateString()}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`min-w-0 flex-1 rounded border border-foreground/20 bg-transparent px-2 py-1 text-foreground ${small ? "text-xs" : "text-sm"}`}
      />
    </label>
  );
}
