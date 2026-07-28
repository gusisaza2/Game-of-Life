import type { ProgressItem } from "@/lib/level-progress";
import type { NivelProgress } from "@/lib/nivel";

function ProgressBar({ label, progress }: { label: string; progress: ProgressItem }) {
  const pct = Math.min(100, (progress.current / progress.threshold) * 100);
  const current =
    Number.isInteger(progress.current) ? progress.current : progress.current.toFixed(2);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs text-foreground/55">
        <span className="font-medium text-foreground/70">{label}</span>
        <span className="tabular-nums">
          {current} / {progress.threshold}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-balance)" }}
        />
      </div>
    </div>
  );
}

function formatXp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function NivelBar({ nivel }: { nivel: NivelProgress }) {
  const pct =
    nivel.nextNivelThreshold === null
      ? 100
      : Math.min(100, (nivel.xpInChapter / nivel.nextNivelThreshold) * 100);
  const remaining =
    nivel.nextNivelThreshold === null ? null : nivel.nextNivelThreshold - nivel.xpInChapter;
  // The Nivel currently being worked toward (1-indexed) — e.g. "Nivel 1"
  // while progressing from 0 reached toward the first threshold.
  const displayNivel = Math.min(nivel.currentNivel + 1, nivel.totalNiveles);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs text-foreground/55">
        <span className="font-medium text-foreground/70">Nivel {displayNivel}</span>
        <span className="tabular-nums">
          {nivel.currentNivel} / {nivel.totalNiveles}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-effort)" }}
        />
      </div>
      <p className="text-xs text-foreground/45">
        {remaining === null
          ? "Último Nivel de este Capítulo"
          : `${formatXp(remaining)} XP para el próximo Nivel`}
      </p>
    </div>
  );
}

export function LevelProgress({
  goodDays,
  nivel,
}: {
  goodDays: ProgressItem | null;
  nivel: NivelProgress | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {goodDays && <ProgressBar label="Good Days" progress={goodDays} />}
      {nivel && <NivelBar nivel={nivel} />}
    </div>
  );
}
