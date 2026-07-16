import { getShipStage } from "@/lib/ship";

// Flat-vector, code-built Ship scene (design doc Section 10.5/10.7 —
// deliberately no external illustration; simple geometric SVG shapes).
// MVP covers only Milestone I's construction: empty dock -> keel laid ->
// ribs appearing one by one as the player progresses through Chapters 1-3.

const RIB_X_START = 185;
const RIB_X_END = 355;
const KEEL_Y = 128;
const RIB_TOP_Y = 55;

function ribPath(x: number): string {
  return `M ${x - 16} ${KEEL_Y} Q ${x} ${RIB_TOP_Y} ${x + 16} ${KEEL_Y}`;
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

        <rect x="0" y="0" width="400" height="150" fill="url(#ship-sky)" />
        <rect x="0" y="150" width="400" height="70" fill="#7fb3c9" />
        <path
          d="M0 162 Q20 156 40 162 T80 162 T120 162 T160 162 T200 162 T240 162 T280 162 T320 162 T360 162 T400 162"
          fill="none"
          stroke="#6ba3ba"
          strokeWidth="2"
          opacity="0.6"
        />

        {/* dock */}
        <rect x="20" y="140" width="8" height="60" fill="#8a5a3b" />
        <rect x="120" y="140" width="8" height="60" fill="#8a5a3b" />
        <rect x="10" y="128" width="130" height="14" fill="#a5713f" />

        {/* lumber pile */}
        <rect x="30" y="108" width="50" height="8" rx="2" fill="#9c6b3e" />
        <rect x="35" y="98" width="45" height="8" rx="2" fill="#b17a45" />
        <rect x="30" y="88" width="40" height="8" rx="2" fill="#9c6b3e" />

        {/* keel */}
        <rect
          x={RIB_X_START - 20}
          y={KEEL_Y - 4}
          width={RIB_X_END - RIB_X_START + 40}
          height="8"
          rx="3"
          fill="#7a4f2e"
        />

        {/* ribs, revealed one by one as construction progresses */}
        {ribXs.slice(0, stage.ribsVisible).map((x, i) => (
          <path
            key={i}
            d={ribPath(x)}
            fill="none"
            stroke="#8a5a3b"
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
