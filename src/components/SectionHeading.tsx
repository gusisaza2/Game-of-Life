// Small accent dot in front of section labels (GOALS, TASKS, HABITS, ...)
// so headers pick up a touch of color too, instead of staying flat gray
// everywhere except the cards themselves.
export function SectionHeading({
  children,
  className = "text-sm font-semibold uppercase tracking-wide text-foreground/60",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--accent-primary)" }}
      />
      {children}
    </h2>
  );
}
