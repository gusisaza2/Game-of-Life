// Avatar base identity taxonomy (design doc Section 12.2). Skin tone gets
// a real range per the design doc's explicit instruction ("a palette with
// meaningful range, not just 2-3 options"); hair style stays to a small
// starter set (short/long/bald) since each one is a hand-built SVG shape --
// more styles are a straightforward follow-up, not a redesign.

export type AvatarGender = "male" | "female";
export type AvatarHairStyle = "short" | "long" | "bald";

export type AvatarConfig = {
  gender: AvatarGender;
  skinTone: string;
  hairStyle: AvatarHairStyle;
  hairColor: string;
  eyeColor: string;
};

export const SKIN_TONES = [
  { id: "porcelain", hex: "#f6dcc8" },
  { id: "light", hex: "#eec6a4" },
  { id: "medium", hex: "#d9a374" },
  { id: "tan", hex: "#b87e52" },
  { id: "deep", hex: "#8a5636" },
  { id: "espresso", hex: "#5a3623" },
] as const;

export const HAIR_COLORS = [
  { id: "black", hex: "#1c1a17" },
  { id: "dark-brown", hex: "#3c2a1e" },
  { id: "brown", hex: "#6b4226" },
  { id: "blonde", hex: "#d9b360" },
  { id: "red", hex: "#a5472b" },
  { id: "gray", hex: "#9a9691" },
  { id: "white", hex: "#efece6" },
] as const;

export const EYE_COLORS = [
  { id: "brown", hex: "#5a3a22" },
  { id: "blue", hex: "#3b6fa5" },
  { id: "green", hex: "#4a7a4e" },
  { id: "hazel", hex: "#7a6a3a" },
  { id: "gray", hex: "#6b7278" },
] as const;

export const HAIR_STYLES: { id: AvatarHairStyle; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "bald", label: "Bald" },
];

export const GENDERS: { id: AvatarGender; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

export function hexFor<T extends { id: string; hex: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.hex ?? list[0].hex;
}
