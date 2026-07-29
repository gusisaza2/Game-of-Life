import { STREAK_GOAL_DAYS } from "@/lib/habit-streak";

// Flat progress ring, 0 -> STREAK_GOAL_DAYS (21). The streak (and its XP
// milestones) can keep going past 21, but the ring itself caps visually
// there — it's the "goal" marker, not a running total.
export function HabitStreakRing({
  streak,
  color,
  size = 56,
  strokeWidth = 5,
}: {
  streak: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(streak, STREAK_GOAL_DAYS) / STREAK_GOAL_DAYS;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 400ms ease-out" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.34}
        fontWeight={600}
        fill="currentColor"
      >
        {streak}
      </text>
    </svg>
  );
}
