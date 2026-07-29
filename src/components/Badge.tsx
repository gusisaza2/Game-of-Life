type Tone = "neutral" | "effort" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-foreground/8 text-foreground/60",
  muted: "bg-foreground/5 text-foreground/35",
  effort: "",
};

// Small status chip (task tier, "activates tomorrow", Goal status) --
// reuses the existing accent tokens rather than inventing new state
// colors, and stays a single consistent shape across the app.
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const style =
    tone === "effort"
      ? {
          color: "var(--accent-effort)",
          backgroundColor: "color-mix(in srgb, var(--accent-effort) 16%, transparent)",
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
