import { getShipStage } from "@/lib/ship";

// Flat-vector, code-built Ship scene (design doc Section 10.5/10.7 —
// deliberately no external illustration; simple geometric SVG shapes).
// MVP covers only Milestone I's construction: empty dock -> keel laid ->
// ribs appearing one by one as the player progresses through Chapters 1-3.

const DOCK_TOP_Y = 130;
const RIB_X_START = 165;
const RIB_X_END = 355;
const KEEL_Y = DOCK_TOP_Y; // Keel sits directly on the dock surface, not floating above it.
const RIB_TOP_Y = 50;

function ribPath(x: number): string {
  return `M ${x - 18} ${KEEL_Y} Q ${x} ${RIB_TOP_Y} ${x + 18} ${KEEL_Y}`;
}

export function Ship({
  currentLevel,
  cumulativeXp,
}: {
  currentLevel: number;
  cumulativeXp: number;
}) {
  const stage = getShipStage(currentLevel, cumulativeXp);
  const ribXs = Array.from({ length: stage.ribCount }, (_, i) =>
    stage.ribCount === 1
      ? RIB_X_START
      : RIB_X_START + (i * (RIB_X_END - RIB_X_START)) / (stage.ribCount - 1),
  );

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-foreground/10">
      <svg
        viewBox="0 0 400 220"
        className="block w-full"
        role="img"
        aria-label="Ship under construction at the dock"
      >
        <defs>
          <linearGradient id="ship-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3d4b8" />
            <stop offset="55%" stopColor="#f0b89a" />
            <stop offset="100%" stopColor="#dce9f0" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="400" height="148" fill="url(#ship-sky)" />
        <rect x="0" y="148" width="400" height="72" fill="#7fb3c9" />
        <path
          d="M0 160 Q20 154 40 160 T80 160 T120 160 T160 160 T200 160 T240 160 T280 160 T320 160 T360 160 T400 160"
          fill="none"
          stroke="#6ba3ba"
          strokeWidth="2"
          opacity="0.6"
        />

        {/* dock — a single continuous platform spanning the whole build
            area, so the keel/ribs clearly rest on solid ground instead of
            floating disconnected next to a shorter dock */}
        <rect x="10" y={DOCK_TOP_Y} width="380" height="14" fill="#9c7a52" />
        {[20, 90, 160, 230, 300, 370].map((x) => (
          <rect key={x} x={x} y={DOCK_TOP_Y + 14} width="8" height="56" fill="#7a5a3a" />
        ))}

        {/* lumber pile, off to the side so it doesn't clash with the keel/ribs */}
        <rect x="25" y="110" width="50" height="8" rx="2" fill="#9c6b3e" />
        <rect x="30" y="100" width="45" height="8" rx="2" fill="#b17a45" />
        <rect x="25" y="90" width="40" height="8" rx="2" fill="#9c6b3e" />

        {/* keel — sits directly on top of the dock, no gap */}
        <rect
          x={RIB_X_START - 15}
          y={KEEL_Y - 8}
          width={RIB_X_END - RIB_X_START + 30}
          height="8"
          rx="3"
          fill="#6b4226"
        />

        {/* ribs, revealed one by one as construction progresses */}
        {ribXs.slice(0, stage.ribsVisible).map((x, i) => (
          <path
            key={i}
            d={ribPath(x)}
            fill="none"
            stroke="#7a5a3a"
            strokeWidth="7"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
