import type { MonthlyCalendar } from "@/lib/habit-stats";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function HabitCalendarHeatmap({
  calendar,
  color,
}: {
  calendar: MonthlyCalendar;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/60">{calendar.monthLabel}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="flex h-6 items-center justify-center text-[10px] text-foreground/35"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: calendar.leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {calendar.days.map((day) => {
          const isCompleted = day.status === "completed";
          const isMissed = day.status === "missed";
          return (
            <div
              key={day.date}
              title={day.date}
              className="flex aspect-square items-center justify-center rounded-md text-[11px] font-medium"
              style={{
                backgroundColor: isCompleted ? color : "transparent",
                border: isMissed
                  ? "1px solid color-mix(in srgb, var(--foreground) 25%, transparent)"
                  : "none",
                color: isCompleted
                  ? "#fff"
                  : isMissed
                    ? "color-mix(in srgb, var(--foreground) 60%, transparent)"
                    : "color-mix(in srgb, var(--foreground) 20%, transparent)",
              }}
            >
              {day.day}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-foreground/40">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          Done
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border border-foreground/30" />
          Missed
        </span>
      </div>
    </div>
  );
}
