// Full-screen expansion of GoalMilestonePath.tsx's compact horizontal
// route -- same node states (completed/current/not-started), same status
// classification, laid out as a bottom-to-top winding path (per Gus's
// direction: reads more like an actual path to climb than a flat list).
// Overview only: no task list here, that already lives in the Goal card
// below it in Manage. Drawing logic lives in WindingPath.tsx, shared with
// the macro Voyage Map (VoyageMap.tsx) -- same visual language at a
// different scale (design doc Section 18.2).

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AreaIcon } from "@/components/AreaIcon";
import { WindingPath, type PathNode } from "@/components/WindingPath";

type Milestone = { id: string; title: string; status: string };

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
  const nodes: PathNode[] = milestones.map((milestone, i) => ({
    id: milestone.id,
    label: milestone.title,
    status: milestone.status === "completed" ? "completed" : i === currentIndex ? "current" : "locked",
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
        <div className="mt-auto">
          <WindingPath nodes={nodes} color={color} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
