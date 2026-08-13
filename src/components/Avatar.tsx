// Flat-vector Avatar bust (design doc Section 12), same code-built SVG
// approach already locked for the Ship and reused for AreaIcon.tsx. Draws
// head/hair/eyes/shoulders only -- no clothing layers yet (MP-earnable
// tops/bottoms/shoes/accessories are deferred until the Nivel Chest
// System's pricing session happens, per CLAUDE.md).

import { hexFor, SKIN_TONES, HAIR_COLORS, EYE_COLORS, type AvatarConfig } from "@/lib/avatar";

function shoulders(gender: AvatarConfig["gender"]) {
  return gender === "male"
    ? "M18 100c2-19 16-28 32-28s30 9 32 28z"
    : "M22 100c1-16 14-25 28-25s27 9 28 25z";
}

function hair(style: AvatarConfig["hairStyle"], color: string) {
  if (style === "bald") return null;
  if (style === "short") {
    return <path d="M25 40c-1-16 10-27 25-27s26 11 25 27c-3-8-11-8-11-15-6 6-16 6-28 0 0 7-8 7-11 15z" fill={color} />;
  }
  return (
    <>
      <path d="M24 40c-2-17 10-29 26-29s28 12 26 29c-3-9-12-9-12-16-6 6-17 6-28 0 0 7-9 7-12 16z" fill={color} />
      <path d="M23 39c-3 10-3 24-1 36h7c-3-13-3-26-1-36z" fill={color} />
      <path d="M77 39c3 10 3 24 1 36h-7c3-13 3-26 1-36z" fill={color} />
    </>
  );
}

export function Avatar({ config, size = 96 }: { config: AvatarConfig; size?: number }) {
  const skin = hexFor(SKIN_TONES, config.skinTone);
  const hairColor = hexFor(HAIR_COLORS, config.hairColor);
  const eyeColor = hexFor(EYE_COLORS, config.eyeColor);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d={shoulders(config.gender)} fill={skin} opacity={0.9} />
      <circle cx="50" cy="42" r="24" fill={skin} />
      <circle cx="42" cy="41" r="2.4" fill={eyeColor} />
      <circle cx="58" cy="41" r="2.4" fill={eyeColor} />
      <path d="M44 51q6 4 12 0" fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round" />
      {hair(config.hairStyle, hairColor)}
    </svg>
  );
}
