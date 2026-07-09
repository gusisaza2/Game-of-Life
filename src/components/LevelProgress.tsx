import type { ProgressItem } from "@/lib/level-progress";
import type { NivelProgress } from "@/lib/nivel";

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

function NivelBar({ nivel }: { nivel: NivelProgress }) {
  const pct =
    nivel.nextNivelThreshold === null
      ? 100
      : Math.min(100, (nivel.goodDaysInChapter / nivel.nextNivelThreshold) * 100);
  const remaining =
    nivel.nextNivelThreshold === null ? null : nivel.nextNivelThreshold - nivel.goodDaysInChapter;
  // The Nivel currently being worked toward (1-indexed) — e.g. "Nivel 1"
  // while progressing from 0 reached toward the first threshold.
  const displayNivel = Math.min(nivel.currentNivel + 1, nivel.totalNiveles);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs text-foreground/60">
        <span>Nivel {displayNivel}</span>
        <span>
          {nivel.currentNivel} / {nivel.totalNiveles}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-foreground/50">
        {remaining === null
          ? "Último Nivel de este Capítulo"
          : `${remaining} Good Day${remaining === 1 ? "" : "s"} para el próximo Nivel`}
      </p>
    </div>
  );
}

export function LevelProgress({
  levelLabel,
  milestoneName,
  xp,
  goodDays,
  nivel,
}: {
  levelLabel: string;
  milestoneName: string | null;
  xp: ProgressItem | null;
  goodDays: ProgressItem | null;
  nivel: NivelProgress | null;
}) {
  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <p className="text-sm font-medium">
        {levelLabel}
        {milestoneName && <span className="text-foreground/60"> · {milestoneName}</span>}
      </p>
      {xp && <ProgressBar label="XP" progress={xp} />}
      {goodDays && <ProgressBar label="Good Days" progress={goodDays} />}
      {nivel && <NivelBar nivel={nivel} />}
    </div>
  );
}
