"use client";

import { useEventOptions } from "./EventsContext";
import { shiftDate } from "@/lib/deadline";
import { getTodayDateString } from "@/lib/today";

// "Prepares for…" picker for a task. Picking an event suggests a deadline
// the day before it (never earlier than today) via onPick.
export function EventLinkSelect({
  name = "eventId",
  value,
  defaultValue,
  onChange,
  onPick,
  small = false,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (eventId: string) => void;
  onPick?: (suggestedDueDate: string) => void;
  small?: boolean;
}) {
  const options = useEventOptions();
  if (options.length === 0) return null;

  return (
    <select
      name={name}
      value={value}
      defaultValue={value === undefined ? defaultValue ?? "" : undefined}
      onChange={(e) => {
        onChange?.(e.target.value);
        const picked = options.find((o) => o.id === e.target.value);
        if (picked && onPick) {
          const dayBefore = shiftDate(picked.date, -1);
          const today = getTodayDateString();
          onPick(dayBefore < today ? (picked.date < today ? today : picked.date) : dayBefore);
        }
      }}
      className={`rounded border border-foreground/20 bg-transparent px-2 py-1 ${small ? "text-xs" : "text-sm"}`}
    >
      <option value="">Not preparing for an event</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          Prepares for: {o.label}
        </option>
      ))}
    </select>
  );
}
