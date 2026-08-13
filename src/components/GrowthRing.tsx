// One Avatar Growth Ring (design doc Section 20): fill = today's XP earned
// in this Area divided by that Area's per-area daily ceiling, resets to
// empty every new day. No number in the center -- unlike HabitStreakRing
// (which shows a streak-day count), this reuses AreaIcon.tsx instead, so
// the two "ring" metaphors never look interchangeable even on the same
// screen.

import { AreaIcon } from "@/components/AreaIcon";

export function GrowthRing({
  areaName,
  fill,
  color,
  size = 48,
  strokeWidth = 6,
}: {
  areaName: string | undefined;
  fill: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(fill, 0), 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={strokeWidth} />
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
      </svg>
      <span style={{ color }} className="h-[38%] w-[38%]">
        <AreaIcon areaName={areaName} className="h-full w-full" />
      </span>
    </div>
  );
}
