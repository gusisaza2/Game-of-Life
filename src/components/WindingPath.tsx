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
// WIDTH stays fixed regardless of `scale` -- it's the one dimension
// that's actually load-bearing for the 375px mobile safe-width fix
// (GoalPathView's original bug). Everything else scales from it.
const WIDTH = 320;
const CENTER_X = WIDTH / 2;

function nodeX(amplitude: number, i: number) {
  return CENTER_X + amplitude * Math.sin((i * Math.PI) / 2);
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

export function WindingPath({
  nodes,
  color,
  scale = 1,
}: {
  nodes: PathNode[];
  color: { accent: string; soft: string };
  // Grows the node circles, their spacing, and the label column -- WIDTH
  // itself never changes, so this stays mobile-safe at any scale.
  scale?: number;
}) {
  const amplitude = 88 * Math.min(scale, 1.15); // capped so nodes never crowd WIDTH's edges
  const spacingY = 124 * scale;
  const paddingY = 40 * scale;
  const nodeSize = 32 * scale;
  const nodeR = nodeSize / 2;
  const labelGap = 12 * scale;
  const labelWidth = 128 * Math.min(scale, 1.2); // capped so long labels don't crowd the opposite column
  const checkSize = 14 * scale;
  const dotSize = 10 * scale;
  const titleTextClass = scale > 1.15 ? "text-base" : "text-sm";

  const n = nodes.length;
  const height = paddingY * 2 + spacingY * Math.max(0, n - 1);

  // Index 0 sits at the bottom; higher indices climb upward.
  const points = nodes.map((_, i) => ({
    x: nodeX(amplitude, i),
    y: height - paddingY - i * spacingY,
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
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{ width: nodeSize, height: nodeSize, backgroundColor: "var(--accent-primary)" }}
                >
                  <svg viewBox="0 0 20 20" width={checkSize} height={checkSize} fill="none">
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
                  className="flex shrink-0 items-center justify-center rounded-full border-2"
                  style={{ width: nodeSize, height: nodeSize, backgroundColor: color.soft, borderColor: color.accent }}
                >
                  <span className="rounded-full" style={{ width: dotSize, height: dotSize, backgroundColor: color.accent }} />
                </span>
              ) : (
                <span
                  className="inline-block shrink-0 rounded-full border-[1.5px] border-foreground/30 bg-surface"
                  style={{ width: nodeSize, height: nodeSize }}
                />
              )}
            </div>

            <div
              className="absolute"
              style={
                labelOnRight
                  ? {
                      left: x + nodeR + labelGap,
                      top: y,
                      transform: "translateY(-50%)",
                      width: labelWidth,
                      textAlign: "left",
                    }
                  : {
                      right: WIDTH - (x - nodeR - labelGap),
                      top: y,
                      transform: "translateY(-50%)",
                      width: labelWidth,
                      textAlign: "right",
                    }
              }
            >
              <p
                className={titleTextClass}
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
