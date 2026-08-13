// Full-screen expansion of GoalMilestonePath.tsx's compact horizontal
// route -- same node states (completed/current/not-started), same status
// classification, laid out as a bottom-to-top winding path instead (per
// Gus's direction: reads more like an actual path to climb than a flat
// list). Overview only, same as the compact version: no task list here,
// that already lives in the Goal card below it in Manage.

"use client";

import { useEffect, useState } from "react";
import { AreaIcon } from "@/components/AreaIcon";

type Milestone = { id: string; title: string; status: string };

function statusLabel(isCompleted: boolean, isCurrent: boolean) {
  if (isCompleted) return "Completed";
  if (isCurrent) return "In progress";
  return "Not started";
}

const AMPLITUDE_FRAC = 0.3; // how far nodes swing from center, as a fraction of width
const SPACING_Y = 124; // px between consecutive nodes, bottom to top
const PADDING_Y = 40;
const NODE_R = 16;
const LABEL_GAP = 12;
const LABEL_WIDTH = 128;

function xFrac(i: number) {
  return 0.5 + AMPLITUDE_FRAC * Math.sin((i * Math.PI) / 2);
}

function buildPathD(points: { xUnit: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M${points[0].xUnit} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midY = (p0.y + p1.y) / 2;
    d += ` C${p0.xUnit} ${midY} ${p1.xUnit} ${midY} ${p1.xUnit} ${p1.y}`;
  }
  return d;
}

export function GoalPathView({
  open,
  onClose,
  goalTitle,
  areaName,
  color,
  milestones,
}: {
  open: boolean;
  onClose: () => void;
  goalTitle: string;
  areaName: string | undefined;
  color: { accent: string; soft: string };
  milestones: Milestone[];
}) {
  const [entered, setEntered] = useState(false);

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

  if (!open) return null;

  const currentIndex = milestones.findIndex((m) => m.status !== "completed");
  const n = milestones.length;
  const height = PADDING_Y * 2 + SPACING_Y * Math.max(0, n - 1);

  // Index 0 sits at the bottom; higher indices climb upward.
  const points = milestones.map((_, i) => ({
    frac: xFrac(i),
    xUnit: xFrac(i) * 100,
    y: height - PADDING_Y - i * SPACING_Y,
  }));

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-6 p-6 transition-transform duration-300 ease-out ${
          entered ? "translate-y-0" : "translate-y-4"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: color.soft, color: color.accent }}
            >
              <AreaIcon areaName={areaName} className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{goalTitle}</p>
              <p className="text-xs text-foreground/60">{areaName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="link-hover text-xs text-foreground/45">
            Close
          </button>
        </div>

        <div className="relative mx-auto w-full" style={{ height }}>
          {n > 1 && (
            <svg
              width="100%"
              height={height}
              viewBox={`0 0 100 ${height}`}
              preserveAspectRatio="none"
              className="absolute inset-0"
            >
              <path
                d={buildPathD(points)}
                fill="none"
                stroke="var(--foreground)"
                strokeOpacity={0.15}
                strokeWidth={0.6}
                strokeDasharray="0.3 3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {milestones.map((milestone, i) => {
            const isCompleted = milestone.status === "completed";
            const isCurrent = i === currentIndex;
            const { frac, y } = points[i];
            const labelOnRight = frac <= 0.5;

            return (
              <div key={milestone.id}>
                <div
                  className="absolute"
                  style={{ left: `${frac * 100}%`, top: y, transform: "translate(-50%, -50%)" }}
                >
                  {isCompleted ? (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--accent-primary)" }}
                    >
                      <svg viewBox="0 0 20 20" width={14} height={14} fill="none">
                        <path
                          d="M5 10.5l3 3 7-7.5"
                          stroke="var(--on-accent-primary)"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : isCurrent ? (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                      style={{ backgroundColor: color.soft, borderColor: color.accent }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.accent }} />
                    </span>
                  ) : (
                    <span className="inline-block h-8 w-8 shrink-0 rounded-full border-[1.5px] border-foreground/30 bg-surface" />
                  )}
                </div>

                <div
                  className="absolute"
                  style={
                    labelOnRight
                      ? {
                          left: `calc(${frac * 100}% + ${NODE_R + LABEL_GAP}px)`,
                          top: y,
                          transform: "translateY(-50%)",
                          width: LABEL_WIDTH,
                          textAlign: "left",
                        }
                      : {
                          right: `calc(${(1 - frac) * 100}% + ${NODE_R + LABEL_GAP}px)`,
                          top: y,
                          transform: "translateY(-50%)",
                          width: LABEL_WIDTH,
                          textAlign: "right",
                        }
                  }
                >
                  <p
                    className="text-sm"
                    style={{
                      fontWeight: isCurrent ? 600 : 400,
                      opacity: isCurrent ? 0.9 : isCompleted ? 0.75 : 0.45,
                    }}
                  >
                    {milestone.title}
                  </p>
                  <p className="text-xs text-foreground/45">{statusLabel(isCompleted, isCurrent)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
