// The 5 fixed Areas' accent colors — used only for lightweight visual
// coding on task cards (a dot + left border), never as the only signal
// (title/tier text always carries the real information).
export const AREA_COLORS: Record<string, { accent: string; soft: string }> = {
  "Physical Health": { accent: "#22a06b", soft: "#22a06b1a" },
  "Mental Health": { accent: "#8b5cf6", soft: "#8b5cf61a" },
  Career: { accent: "#3b82f6", soft: "#3b82f61a" },
  Relationships: { accent: "#ff6f61", soft: "#ff6f611a" },
  Exploration: { accent: "#e8a318", soft: "#e8a3181a" },
};

export const DEFAULT_AREA_COLOR = { accent: "#8a8a8a", soft: "#8a8a8a1a" };

export function areaColor(areaName: string | undefined) {
  if (!areaName) return DEFAULT_AREA_COLOR;
  return AREA_COLORS[areaName] ?? DEFAULT_AREA_COLOR;
}
