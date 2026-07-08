import type { ProgressItem } from "@/lib/level-progress";

function ProgressBar({ label, progress }: { label: string; progress: ProgressItem }) {
  const pct = Math.min(100, (progress.current / progress.threshold) * 100);
  const current =
    Number.isInteger(progress.current) ? progress.current : progress.current.toFixed(2);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs text-foreground/60">
        <span>{label}</span>
        <span>
          {current} / {progress.threshold}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LevelProgress({
  levelLabel,
  milestoneName,
  xp,
  goodDays,
}: {
  levelLabel: string;
  milestoneName: string | null;
  xp: ProgressItem | null;
  goodDays: ProgressItem | null;
}) {
  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <p className="text-sm font-medium">
        {levelLabel}
        {milestoneName && <span className="text-foreground/60"> · {milestoneName}</span>}
      </p>
      {xp && <ProgressBar label="XP" progress={xp} />}
      {goodDays && <ProgressBar label="Good Days" progress={goodDays} />}
    </div>
  );
}
