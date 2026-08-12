// Each Area's icon is its already-locked Ship part (design doc Section
// 10.2: Physical = hull, Mental = helm, Career = sails, Relationships =
// crew quarters, Exploration = crow's nest/spyglass). Reusing that mapping
// here -- before the Ship itself is built -- gives Goals/Milestones a
// visual identity that already means something in the game's world,
// instead of a generic icon set invented just for this screen.
//
// Career is the one deliberate deviation from that mapping (Gus's own
// Career is music/songwriting -- see the "Songwriting Camps" Goal) --
// swapped to a pair of sixteenth notes instead of sails. This is a
// personal customization, not a change to the locked design doc mapping.

function Hull() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 8h14l-2.2 5.2a2 2 0 0 1-1.85 1.3H7.05a2 2 0 0 1-1.85-1.3z" strokeLinejoin="round" />
      <path d="M6.5 8V5" strokeLinecap="round" />
    </svg>
  );
}

function Helm() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path
        strokeLinecap="round"
        d="M10 4v-1.5M10 16v1.5M4 10h-1.5M16 10h1.5M5.8 5.8l-1-1M14.2 14.2l1 1M14.2 5.8l1-1M5.8 14.2l-1 1"
      />
    </svg>
  );
}

function MusicNotes() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M8 15.1V4.6M15.4 16.4V6.4" />
      <path d="M8 4.6l7.4 1.8" strokeWidth="1.7" />
      <path d="M8 7.4l7.4 1.8" strokeWidth="1.7" />
      <ellipse cx="6" cy="15.4" rx="2.1" ry="1.6" fill="currentColor" stroke="none" transform="rotate(-18 6 15.4)" />
      <ellipse cx="13.4" cy="16.7" rx="2.1" ry="1.6" fill="currentColor" stroke="none" transform="rotate(-18 13.4 16.7)" />
    </svg>
  );
}

function CrewQuarters() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="10" cy="10" r="6.2" />
      <circle cx="10" cy="10" r="3.6" strokeWidth="1.1" />
      <path
        strokeLinecap="round"
        strokeWidth="1.1"
        d="M10 6.2V4.7M10 15.3v-1.5M6.2 10H4.7M15.3 10h-1.5"
      />
    </svg>
  );
}

function Spyglass() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M4 16 16 4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="4" cy="16" r="2.3" strokeWidth="1.3" />
      <circle cx="16" cy="4" r="1.4" strokeWidth="1.3" />
    </svg>
  );
}

const AREA_ICONS: Record<string, () => React.ReactElement> = {
  "Physical Health": Hull,
  "Mental Health": Helm,
  Career: MusicNotes,
  Relationships: CrewQuarters,
  Exploration: Spyglass,
};

export function AreaIcon({
  areaName,
  className = "h-4 w-4",
}: {
  areaName: string | undefined;
  className?: string;
}) {
  const Icon = (areaName && AREA_ICONS[areaName]) || Hull;
  return (
    <span className={className} aria-hidden>
      <Icon />
    </span>
  );
}
