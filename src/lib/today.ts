// CLAUDE.md's day boundary is midnight-to-midnight in the PLAYER's local
// timezone -- but this runs on Vercel's serverless functions, which use
// UTC as their system timezone, not Gus's (America/Bogota, UTC-5, no
// DST). Using Date's own getFullYear/getMonth/getDate would silently
// compute the *server's* calendar day instead, which drifts from Gus's
// actual day for a multi-hour window every evening (found via a real bug
// report: a habit marked at night showed as already-completed the next
// afternoon, because the server had already rolled its UTC date over
// while it was still "yesterday" in Bogota). Intl.DateTimeFormat with an
// explicit timeZone sidesteps the process's own TZ entirely.
const PLAYER_TIMEZONE = "America/Bogota";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLAYER_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getDateString(date: Date): string {
  return dateFormatter.format(date);
}

export function getTodayDateString(): string {
  return getDateString(new Date());
}

export function getTomorrowDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getDateString(date);
}

export function daysBetween(earlierDate: string, laterDate: string): number {
  const a = new Date(`${earlierDate}T00:00:00`);
  const b = new Date(`${laterDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
