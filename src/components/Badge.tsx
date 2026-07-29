type Tone = "neutral" | "effort" | "balance" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-foreground/8 text-foreground/60",
  muted: "bg-foreground/5 text-foreground/35",
  effort: "",
  balance: "",
};

const TINTED_VAR: Partial<Record<Tone, string>> = {
  effort: "--accent-effort",
  // Good Day is the Balance axis (design doc Section 2) -- same color as
  // the Good Days progress bar, so the badge reads as "the same signal."
  balance: "--accent-balance",
};

// Small status chip (task tier, "activates tomorrow", Goal status) --
// reuses the existing accent tokens rather than inventing new state
// colors, and stays a single consistent shape across the app.
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const tintedVar = TINTED_VAR[tone];
  const style = tintedVar
    ? {
        color: `var(${tintedVar})`,
        backgroundColor: `color-mix(in srgb, var(${tintedVar}) 16%, transparent)`,
      }
    : undefined;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
      style={style}
    >
      {children}
    </span>
  );
}
