// Full-screen expansion of GoalMilestonePath.tsx's compact horizontal
// route -- same node states (completed/current/not-started), same status
// classification, laid out as a bottom-to-top winding path instead (per
// Gus's direction: reads more like an actual path to climb than a flat
// list). Overview only, same as the compact version: no task list here,
// that already lives in the Goal card below it in Manage.

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AreaIcon } from "@/components/AreaIcon";

type Milestone = { id: string; title: string; status: string };

function statusLabel(isCompleted: boolean, isCurrent: boolean) {
  if (isCompleted) return "Completed";
  if (isCurrent) return "In progress";
  return "Not started";
}

// Fixed pixel coordinate space (not percentage-based) so the SVG viewBox
// maps 1:1 to real pixels on both axes -- a fractional x-axis stretched via
// preserveAspectRatio="none" against a real-pixel y-axis was previously
// distorting the dashed stroke unpredictably (non-uniform scale mangles
// dash length along diagonal segments). 320px comfortably fits inside the
// max-w-md wrapper's content width on every viewport this app targets,
// including the 375px mobile preset.
const WIDTH = 320;
const CENTER_X = WIDTH / 2;
const AMPLITUDE = 88; // how far nodes swing from center, in px
const SPACING_Y = 124; // px between consecutive nodes, bottom to top
const PADDING_Y = 40;
const NODE_R = 16;
const LABEL_GAP = 12;
const LABEL_WIDTH = 128;

function nodeX(i: number) {
  return CENTER_X + AMPLITUDE * Math.sin((i * Math.PI) / 2);
}

function buildPathD(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midY = (p0.y + p1.y) / 2;
    d += ` C${p0.x} ${midY} ${p1.x} ${midY} ${p1.x} ${p1.y}`;
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
    x: nodeX(i),
    y: height - PADDING_Y - i * SPACING_Y,
  }));

  // Portaled straight to document.body: template.tsx's page-transition
  // wrapper applies a CSS transform, which per spec makes it the containing
  // block for any position:fixed descendant. Left un-portaled, this overlay
  // would size and position itself against the whole scrollable page
  // instead of the actual viewport (visible as needing scrollTo(0,0) to
  // look right, and as mt-auto pushing content to the page's bottom rather
  // than the screen's).
  return createPortal(
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6 transition-transform duration-300 ease-out ${
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

        {/* mt-auto anchors the path to the bottom of the screen, so the
            current milestone -- always at the bottom of the climb -- sits
            near where the player is actually looking, instead of floating
            in the upper half with empty space below it. */}
        <div className="relative mx-auto mt-auto" style={{ width: WIDTH, height }}>
          {n > 1 && (
            <svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} className="absolute inset-0">
              <path
                d={buildPathD(points)}
                fill="none"
                stroke="var(--foreground)"
                strokeOpacity={0.2}
                strokeWidth={2}
                strokeDasharray="1 8"
                strokeLinecap="round"
              />
            </svg>
          )}

          {milestones.map((milestone, i) => {
            const isCompleted = milestone.status === "completed";
            const isCurrent = i === currentIndex;
            const { x, y } = points[i];
            const labelOnRight = x <= CENTER_X;

            return (
              <div key={milestone.id}>
                <div className="absolute" style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}>
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
                          left: x + NODE_R + LABEL_GAP,
                          top: y,
                          transform: "translateY(-50%)",
                          width: LABEL_WIDTH,
                          textAlign: "left",
                        }
                      : {
                          right: WIDTH - (x - NODE_R - LABEL_GAP),
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
    </div>,
    document.body,
  );
}
