// The mini-route from design doc Section 18.2/18.3: the same node/route
// visual language as the (not-yet-built) account-level Voyage Map, at
// Milestone scale instead of Capítulo scale. Replaces the flat progress
// bar that used to sit above the Milestone list on a Goal card -- the
// list itself (MilestoneRow, with its expand/add-task controls) is
// untouched, this is purely the "at a glance" summary above it.

type Milestone = { id: string; title: string; status: string };

const NODE_SPACING = 92;
const PADDING_X = 46;
const CY = 28;
const SVG_HEIGHT = 68;

function truncateLabel(title: string): string {
  return title.length > 13 ? `${title.slice(0, 12)}…` : title;
}

export function GoalMilestonePath({
  milestones,
  color,
}: {
  milestones: Milestone[];
  color: { accent: string; soft: string };
}) {
  if (milestones.length === 0) return null;

  // The first not-yet-completed Milestone reads as "current" -- Milestones
  // don't actually have a "locked" status in the data model (all are
  // 'active' until 'completed'), so anything after the current one is
  // just styled as not-started-yet for this view; nothing stops a player
  // from working on it directly via the list below.
  const currentIndex = milestones.findIndex((m) => m.status !== "completed");

  const width = PADDING_X * 2 + NODE_SPACING * Math.max(0, milestones.length - 1);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={SVG_HEIGHT} viewBox={`0 0 ${width} ${SVG_HEIGHT}`} className="block">
        {milestones.length > 1 && (
          <line
            x1={PADDING_X}
            y1={CY}
            x2={PADDING_X + NODE_SPACING * (milestones.length - 1)}
            y2={CY}
            stroke="var(--foreground)"
            strokeOpacity={0.15}
            strokeWidth={2}
            strokeDasharray="1 8"
            strokeLinecap="round"
          />
        )}
        {milestones.map((milestone, i) => {
          const cx = PADDING_X + i * NODE_SPACING;
          const isCompleted = milestone.status === "completed";
          const isCurrent = i === currentIndex;

          return (
            <g key={milestone.id}>
              {isCompleted ? (
                <>
                  <circle cx={cx} cy={CY} r={13} fill="var(--accent-primary)" />
                  <path
                    d={`M${cx - 5} ${CY} l3.5 3.5 l6.5 -7`}
                    fill="none"
                    stroke="var(--on-accent-primary)"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : isCurrent ? (
                <>
                  <circle cx={cx} cy={CY} r={17} fill={color.soft} stroke={color.accent} strokeWidth={2.5} />
                  <circle cx={cx} cy={CY} r={5} fill={color.accent} />
                </>
              ) : (
                <circle
                  cx={cx}
                  cy={CY}
                  r={13}
                  fill="var(--surface)"
                  stroke="var(--foreground)"
                  strokeOpacity={0.3}
                  strokeWidth={1.5}
                />
              )}
              <text
                x={cx}
                y={CY + 30}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={isCurrent ? 600 : 400}
                fill="var(--foreground)"
                fillOpacity={isCurrent ? 0.85 : 0.45}
              >
                {truncateLabel(milestone.title)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
