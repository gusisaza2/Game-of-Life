// Shared node/route visual language (design doc Section 18.3), used at
// both scales the design doc calls out (18.2): the macro Voyage Map
// (Capítulos 1-15, VoyageMap.tsx) and the micro per-Goal Milestone path
// (GoalPathView.tsx). Same states, same bottom-to-top winding layout --
// "same node-and-route pattern... not two different designs." Extracted
// here once both call sites needed the identical drawing logic, rather
// than risk the two copies drifting (this exact code has already had two
// real bugs found and fixed once).

"use client";

export type PathNode = {
  id: string;
  label: string;
  status: "completed" | "current" | "locked";
};

// Fixed pixel coordinate space (not percentage-based) so the SVG viewBox
// maps 1:1 to real pixels on both axes -- a fractional x-axis stretched via
// preserveAspectRatio="none" against a real-pixel y-axis previously
// distorted the dashed stroke unpredictably (non-uniform scale mangles
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

function statusLabel(status: PathNode["status"]) {
  if (status === "completed") return "Completed";
  if (status === "current") return "In progress";
  return "Not started";
}

export function WindingPath({ nodes, color }: { nodes: PathNode[]; color: { accent: string; soft: string } }) {
  const n = nodes.length;
  const height = PADDING_Y * 2 + SPACING_Y * Math.max(0, n - 1);

  // Index 0 sits at the bottom; higher indices climb upward.
  const points = nodes.map((_, i) => ({
    x: nodeX(i),
    y: height - PADDING_Y - i * SPACING_Y,
  }));

  return (
    <div className="relative mx-auto" style={{ width: WIDTH, height }}>
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

      {nodes.map((node, i) => {
        const { x, y } = points[i];
        const labelOnRight = x <= CENTER_X;

        return (
          <div key={node.id}>
            <div className="absolute" style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}>
              {node.status === "completed" ? (
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
              ) : node.status === "current" ? (
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
                  fontWeight: node.status === "current" ? 600 : 400,
                  opacity: node.status === "current" ? 0.9 : node.status === "completed" ? 0.75 : 0.45,
                }}
              >
                {node.label}
              </p>
              <p className="text-xs text-foreground/45">{statusLabel(node.status)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
