// CLAUDE.md's day boundary is midnight-to-midnight in the PLAYER's local
// timezone -- but this runs on Vercel's serverless functions, which use
// UTC as their system timezone, not Gus's (America/Bogota, UTC-5, no
// DST). Using Date's own getFullYear/getMonth/getDate would silently
// compute the *server's* calendar day instead, which drifts from Gus's
// actual day for a multi-hour window every evening (found via a real bug
// report: a habit marked at night showed as already-completed the next
// afternoon, because the server had already rolled its UTC date over
// while it was still "yesterday" in Bogota).
//
// A first fix used Intl.DateTimeFormat with an explicit America/Bogota
// timeZone -- correct, and it worked in local testing, but it crashed
// Vercel's production function outright (SIGABRT, core dump, 29ms
// execution, zero outgoing requests -- i.e. it never even reached the
// database, it died at module init). Vercel's Node runtime apparently
// doesn't carry the full ICU timezone database that a locally-installed
// Node does, so resolving a named IANA zone can abort the process at a
// level a try/catch can't intercept, instead of cleanly throwing.
//
// Bogota has a fixed UTC-5 offset with no DST, so there's no need for a
// timezone database at all -- shift the instant by a constant number of
// hours and read it back with the UTC getters, which are plain
// ECMAScript with no ICU dependency whatsoever.
const BOGOTA_OFFSET_HOURS = -5;
const BOGOTA_OFFSET_MS = BOGOTA_OFFSET_HOURS * 60 * 60 * 1000;

export function getDateString(date: Date): string {
  const shifted = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return getDateString(new Date());
}

export function getTomorrowDateString(): string {
  return getDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

export function daysBetween(earlierDate: string, laterDate: string): number {
  const a = new Date(`${earlierDate}T00:00:00`);
  const b = new Date(`${laterDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
